/* eslint-disable @typescript-eslint/no-explicit-any */
import { MarinadeConfig } from './config/marinade-config'
import {
  AnchorProvider,
  BN,
  ProgramAccount,
  Provider,
  web3,
} from '@coral-xyz/anchor'
import { MarinadeState } from './marinade-state/marinade-state'
import {
  getAssociatedTokenAccountAddress,
  getOrCreateAssociatedTokenAccount,
  getParsedStakeAccountInfo,
} from './util/anchor'
import {
  DepositOptions,
  ErrorMessage,
  MarinadeResult,
  ValidatorStats,
} from './marinade.types'
import { MarinadeFinanceProgram } from './programs/marinade-finance-program'
import { MarinadeReferralProgram } from './programs/marinade-referral-program'
import { MarinadeReferralPartnerState } from './marinade-referral-state/marinade-referral-partner-state'
import { MarinadeReferralGlobalState } from './marinade-referral-state/marinade-referral-global-state'
import { assertNotNullAndReturn } from './util/assert'
import {
  TICKET_ACCOUNT_SIZE,
  TicketAccount,
} from './marinade-state/borsh/ticket-account'
import {
  computeMsolAmount,
  ParsedStakeAccountInfo,
  proportionalBN,
} from './util'
import {
  DEFAULT_DIRECTED_STAKE_ROOT,
  DirectedStakeSdk,
  DirectedStakeVoteRecord,
  findVoteRecords,
  voteRecordAddress,
  withCreateVote,
  withRemoveVote,
  withUpdateVote,
} from '@marinade.finance/directed-stake-sdk'
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'
import { withdrawStake } from '@solana/spl-stake-pool'
import {
  computeExpectedSOL,
  identifyValidatorFromTx,
  selectSpecificValidator,
} from './util/stake-pool-helpers'
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  StakeProgram,
  Transaction,
} from '@solana/web3.js'

export class Marinade {
  constructor(public readonly config: MarinadeConfig = new MarinadeConfig()) {}

  readonly provider: Provider = new AnchorProvider(
    this.config.connection,
    new NodeWallet(web3.Keypair.generate()),
    { commitment: 'confirmed' }
  )

  private directedStakeSdk = new DirectedStakeSdk({
    connection: this.config.connection,
    wallet: {
      signTransaction: async () => new Promise(() => new web3.Transaction()),
      signAllTransactions: async () =>
        new Promise(() => [new web3.Transaction()]),
      publicKey: this.config.publicKey ?? web3.PublicKey.default,
    },
  })

  /**
   * The main Marinade Program
   */
  readonly marinadeFinanceProgram = new MarinadeFinanceProgram(
    this.config.marinadeFinanceProgramId,
    this.provider
  )

  /**
   * The Marinade Program for referral partners
   */
  readonly marinadeReferralProgram = new MarinadeReferralProgram(
    this.config.marinadeReferralProgramId,
    this.provider,
    this.config.referralCode,
    this
  )

  private isReferralProgram(): boolean {
    return this.config.referralCode !== null
  }

  private provideReferralOrMainProgram():
    | MarinadeFinanceProgram
    | MarinadeReferralProgram {
    return this.isReferralProgram()
      ? this.marinadeReferralProgram
      : this.marinadeFinanceProgram
  }

  /**
   * Fetch the Marinade's internal state
   */
  async getMarinadeState(): Promise<MarinadeState> {
    return MarinadeState.fetch(this)
  }

  /**
   * Fetch the Marinade referral partner's state
   */
  async getReferralPartnerState(
    referralCode?: web3.PublicKey
  ): Promise<MarinadeReferralPartnerState> {
    return MarinadeReferralPartnerState.fetch(this, referralCode)
  }

  /**
   * Fetch the Marinade referral program's global state
   */
  async getReferralGlobalState(): Promise<MarinadeReferralGlobalState> {
    return MarinadeReferralGlobalState.fetch(this)
  }

  /**
   * Fetch all the referral partners
   */
  async getReferralPartners(): Promise<MarinadeReferralPartnerState[]> {
    const accounts = await this.config.connection.getProgramAccounts(
      new web3.PublicKey(this.config.marinadeReferralProgramId),
      {
        filters: [
          {
            dataSize:
              this.marinadeReferralProgram.program.account.referralState.size +
              20 +
              96, // number of bytes,
          },
        ],
      }
    )
    const codes = accounts.map(acc => acc.pubkey)
    return await Promise.all(
      codes.map(referralCode => this.getReferralPartnerState(referralCode))
    )
  }

  /**
   * Fetches the voteRecord of a given user
   *
   * @param {web3.PublicKey} userPublicKey - The PublicKey of the user
   */
  async getUsersVoteRecord(userPublicKey: web3.PublicKey): Promise<{
    voteRecord: ProgramAccount<DirectedStakeVoteRecord> | undefined
    address: web3.PublicKey
  }> {
    const address = voteRecordAddress({
      root: new web3.PublicKey(DEFAULT_DIRECTED_STAKE_ROOT),
      owner: userPublicKey,
    }).address

    const voteRecords = await findVoteRecords({
      sdk: this.directedStakeSdk,
      owner: userPublicKey,
    })

    return {
      voteRecord: voteRecords.length === 1 ? voteRecords[0] : undefined,
      address,
    }
  }

  /**
   * Returns a transaction with the instructions to
   * Add liquidity to the liquidity pool and receive LP tokens
   *
   * @param {BN} amountLamports - The amount of lamports added to the liquidity pool
   */
  async addLiquidity(amountLamports: BN): Promise<MarinadeResult.AddLiquidity> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedLPTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(
      this.provider,
      marinadeState.lpMintAddress,
      ownerAddress
    )

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const addLiquidityInstruction =
      await this.marinadeFinanceProgram.addLiquidityInstructionBuilder({
        marinadeState,
        associatedLPTokenAccountAddress,
        ownerAddress,
        amountLamports,
      })

    transaction.add(addLiquidityInstruction)

    return {
      associatedLPTokenAccountAddress,
      transaction,
    }
  }

  /**
   * Returns a transaction with the instructions to
   * Burn LP tokens and get SOL and mSOL back from the liquidity pool
   *
   * @param {BN} amountLamports - The amount of LP tokens burned
   */
  async removeLiquidity(
    amountLamports: BN
  ): Promise<MarinadeResult.RemoveLiquidity> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const associatedLPTokenAccountAddress =
      await getAssociatedTokenAccountAddress(
        marinadeState.lpMintAddress,
        ownerAddress
      )

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(
      this.provider,
      marinadeState.mSolMintAddress,
      ownerAddress
    )

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const removeLiquidityInstruction =
      await this.marinadeFinanceProgram.removeLiquidityInstructionBuilder({
        amountLamports,
        marinadeState,
        ownerAddress,
        associatedLPTokenAccountAddress,
        associatedMSolTokenAccountAddress,
      })

    transaction.add(removeLiquidityInstruction)

    return {
      associatedLPTokenAccountAddress,
      associatedMSolTokenAccountAddress,
      transaction,
    }
  }

  /**
   * Creates necessary directed stake voting instructions for the specified validator.
   * If the vote address is left undefined the standard delegation strategy is used.
   *
   * @param {web3.PublicKey} validatorVoteAddress - The vote address to identify the validator
   */
  async createDirectedStakeVoteIx(
    validatorVoteAddress?: web3.PublicKey
  ): Promise<web3.TransactionInstruction | undefined> {
    const owner = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const { voteRecord } = await this.getUsersVoteRecord(owner)

    if (!voteRecord) {
      if (validatorVoteAddress) {
        return (
          await withCreateVote({
            sdk: this.directedStakeSdk,
            target: validatorVoteAddress,
          })
        ).instruction
      }
      return
    }

    if (validatorVoteAddress) {
      return (
        await withUpdateVote({
          sdk: this.directedStakeSdk,
          target: validatorVoteAddress,
          voteRecord: voteRecord.publicKey,
        })
      ).instruction
    }

    return (
      await withRemoveVote({
        sdk: this.directedStakeSdk,
        voteRecord: voteRecord.publicKey,
      })
    ).instruction
  }

  /**
   * Returns a transaction with the instructions to
   * Stake SOL in exchange for mSOL
   *
   * @param {BN} amountLamports - The amount lamports staked
   * @param {DepositOptions} options - Additional deposit options
   */
  async deposit(
    amountLamports: BN,
    options: DepositOptions = {}
  ): Promise<MarinadeResult.Deposit> {
    const feePayer = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const mintToOwnerAddress = assertNotNullAndReturn(
      options.mintToOwnerAddress ?? this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(
      this.provider,
      marinadeState.mSolMintAddress,
      mintToOwnerAddress,
      feePayer
    )

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const program = this.provideReferralOrMainProgram()
    const depositInstruction = await program.depositInstructionBuilder({
      amountLamports,
      marinadeState,
      transferFrom: feePayer,
      associatedMSolTokenAccountAddress,
    })

    transaction.add(depositInstruction)

    return {
      associatedMSolTokenAccountAddress,
      transaction,
    }
  }

  /**
   *  * ⚠️ WARNING ⚠️ The liquidity in the pool for this swap is typically low,
   * which can result in high transaction fees. It is advisable to consider
   * Jup swap API or proceed with caution.
   *
   * Returns a transaction with the instructions to
   * Swap your mSOL to get back SOL immediately using the liquidity pool
   *
   * @param {BN} amountLamports - The amount of mSOL exchanged for SOL
   */
  async liquidUnstake(
    amountLamports: BN,
    associatedMSolTokenAccountAddress?: web3.PublicKey
  ): Promise<MarinadeResult.LiquidUnstake> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    if (!associatedMSolTokenAccountAddress) {
      const associatedTokenAccountInfos =
        await getOrCreateAssociatedTokenAccount(
          this.provider,
          marinadeState.mSolMintAddress,
          ownerAddress
        )
      const createAssociateTokenInstruction =
        associatedTokenAccountInfos.createAssociateTokenInstruction
      associatedMSolTokenAccountAddress =
        associatedTokenAccountInfos.associatedTokenAccountAddress

      if (createAssociateTokenInstruction) {
        transaction.add(createAssociateTokenInstruction)
      }
    }

    const program = this.provideReferralOrMainProgram()
    const liquidUnstakeInstruction =
      await program.liquidUnstakeInstructionBuilder({
        amountLamports,
        marinadeState,
        ownerAddress,
        associatedMSolTokenAccountAddress,
      })

    transaction.add(liquidUnstakeInstruction)

    return {
      associatedMSolTokenAccountAddress,
      transaction,
    }
  }

  /**
   * Returns a transaction with the instructions to
   * Deposit a delegated stake account.
   * Note that the stake must be fully activated and the validator must be known to Marinade
   *
   * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
   */
  async depositStakeAccount(
    stakeAccountAddress: web3.PublicKey
  ): Promise<MarinadeResult.DepositStakeAccount> {
    const stakeAccountInfo = await getParsedStakeAccountInfo(
      this.provider,
      stakeAccountAddress
    )
    const marinadeState = await this.getMarinadeState()
    const rent =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        web3.StakeProgram.space
      )

    return this.depositStakeAccountByAccount(
      stakeAccountInfo,
      rent,
      marinadeState
    )
  }

  /**
   * @beta
   *
   * Returns a transaction with the instructions to
   * Deposit a deactivating stake account.
   * Note that the stake must be deactivating and the validator must be known to Marinade
   *
   * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
   */
  async depositDeactivatingStakeAccount(
    stakeAccountAddress: web3.PublicKey
  ): Promise<MarinadeResult.DepositDeactivatingStakeAccount> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )

    const stakeAccountInfo = await getParsedStakeAccountInfo(
      this.provider,
      stakeAccountAddress
    )

    if (!stakeAccountInfo.voterAddress) {
      throw new Error("Stake account's votes could not be fetched/parsed.")
    }

    const marinadeState = await this.getMarinadeState()

    const delegateTransaction = StakeProgram.delegate({
      stakePubkey: stakeAccountAddress,
      authorizedPubkey: ownerAddress,
      votePubkey: stakeAccountInfo.voterAddress,
    })

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(
      this.provider,
      marinadeState.mSolMintAddress,
      ownerAddress
    )

    if (createAssociateTokenInstruction) {
      delegateTransaction.instructions.push(createAssociateTokenInstruction)
    }

    const duplicationFlag = await marinadeState.validatorDuplicationFlag(
      stakeAccountInfo.voterAddress
    )
    const { validatorRecords } = await marinadeState.getValidatorRecords()
    const validatorLookupIndex = validatorRecords.findIndex(
      ({ validatorAccount }) =>
        validatorAccount.equals(stakeAccountInfo.voterAddress!)
    )
    const validatorIndex =
      validatorLookupIndex === -1
        ? marinadeState.state.validatorSystem.validatorList.count
        : validatorLookupIndex

    const depositInstruction =
      await this.provideReferralOrMainProgram().depositStakeAccountInstructionBuilder(
        {
          validatorIndex,
          marinadeState,
          duplicationFlag,
          ownerAddress,
          stakeAccountAddress,
          authorizedWithdrawerAddress: ownerAddress,
          associatedMSolTokenAccountAddress,
        }
      )

    delegateTransaction.instructions.push(depositInstruction)

    return {
      transaction: delegateTransaction,
      associatedMSolTokenAccountAddress,
    }
  }

  /**
   * Returns a transaction with the instructions to
   * Deposit a delegated stake account.
   * Note that the stake must be fully activated and the validator must be known to Marinade
   *
   * @param {ParsedStakeAccountInfo} stakeAccountInfo - Parsed Stake Account info
   * @param {number} rent - Rent needed for a stake account
   * @param {MarinadeState} marinadeState - Marinade State needed for retrieving validator info
   */
  async depositStakeAccountByAccount(
    stakeAccountInfo: ParsedStakeAccountInfo,
    rent: number,
    marinadeState: MarinadeState
  ): Promise<MarinadeResult.DepositStakeAccount> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const transaction = new web3.Transaction()
    const currentEpoch = await this.provider.connection.getEpochInfo()

    const {
      authorizedWithdrawerAddress,
      voterAddress,
      activationEpoch,
      isCoolingDown,
      isLockedUp,
      stakedLamports,
      balanceLamports,
    } = stakeAccountInfo

    if (!authorizedWithdrawerAddress) {
      throw new Error('Withdrawer address is not available!')
    }

    if (isLockedUp) {
      throw new Error('The stake account is locked up!')
    }

    if (!activationEpoch || !voterAddress) {
      throw new Error('The stake account is not delegated!')
    }

    if (isCoolingDown) {
      transaction.add(
        web3.StakeProgram.delegate({
          stakePubkey: stakeAccountInfo.address,
          authorizedPubkey: ownerAddress,
          votePubkey: voterAddress,
        })
      )
    }

    if (stakedLamports && balanceLamports?.gt(stakedLamports)) {
      const lamportsToWithdraw =
        balanceLamports.sub(stakedLamports).toNumber() - rent
      if (lamportsToWithdraw > 0)
        transaction.add(
          web3.StakeProgram.withdraw({
            stakePubkey: stakeAccountInfo.address,
            authorizedPubkey: ownerAddress,
            toPubkey: ownerAddress,
            lamports: lamportsToWithdraw,
          })
        )
    }

    const waitEpochs = 2
    const earliestDepositEpoch = activationEpoch.addn(waitEpochs)
    if (earliestDepositEpoch.gtn(currentEpoch.epoch)) {
      throw new Error(
        `Deposited stake ${stakeAccountInfo.address} is not activated yet. Wait for #${earliestDepositEpoch} epoch`
      )
    }

    const { validatorRecords } = await marinadeState.getValidatorRecords()
    const validatorLookupIndex = validatorRecords.findIndex(
      ({ validatorAccount }) => validatorAccount.equals(voterAddress)
    )
    const validatorIndex =
      validatorLookupIndex === -1
        ? marinadeState.state.validatorSystem.validatorList.count
        : validatorLookupIndex

    const duplicationFlag = await marinadeState.validatorDuplicationFlag(
      voterAddress
    )

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(
      this.provider,
      marinadeState.mSolMintAddress,
      ownerAddress
    )

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const program = this.provideReferralOrMainProgram()
    const depositStakeAccountInstruction =
      await program.depositStakeAccountInstructionBuilder({
        validatorIndex,
        marinadeState,
        duplicationFlag,
        authorizedWithdrawerAddress,
        associatedMSolTokenAccountAddress,
        ownerAddress,
        stakeAccountAddress: stakeAccountInfo.address,
      })

    transaction.add(depositStakeAccountInstruction)

    return {
      associatedMSolTokenAccountAddress,
      voterAddress,
      transaction,
      mintRatio: marinadeState.mSolPrice,
    }
  }

  /**
   * @beta
   *
   * Generates a transaction to partially convert a fully activated delegated stake account into mSOL,
   * while the remaining balance continues to be staked in its native form.
   *
   * Requirements:
   * - The stake's validator should be recognized by Marinade.
   * - The transaction should be executed immediately after being generated.
   * - A minimum amount of 1 SOL is required for conversion to mSOL.
   *
   * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
   * @param {BN} solToKeep - Amount of SOL lamports to keep
   */
  async partiallyDepositStakeAccount(
    stakeAccountAddress: web3.PublicKey,
    solToKeep: BN
  ): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )

    const stakeAccountInfo = await getParsedStakeAccountInfo(
      this.provider,
      stakeAccountAddress
    )

    if (
      stakeAccountInfo.balanceLamports &&
      stakeAccountInfo.balanceLamports?.sub(solToKeep).toNumber() < 1
    ) {
      throw new Error("Can't deposit less than 1 SOL")
    }

    const rent =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        web3.StakeProgram.space
      )
    const marinadeState = await this.getMarinadeState()

    const newStakeAccountKeypair = Keypair.generate()

    const splitStakeTx = StakeProgram.split({
      stakePubkey: stakeAccountAddress,
      authorizedPubkey: ownerAddress,
      splitStakePubkey: newStakeAccountKeypair.publicKey,
      lamports: solToKeep.toNumber(),
    })

    const {
      transaction: depositTx,
      associatedMSolTokenAccountAddress,
      voterAddress,
    } = await this.depositStakeAccountByAccount(
      stakeAccountInfo,
      rent,
      marinadeState
    )

    splitStakeTx.instructions.push(...depositTx.instructions)

    return {
      transaction: splitStakeTx,
      associatedMSolTokenAccountAddress,
      stakeAccountKeypair: newStakeAccountKeypair,
      voterAddress,
    }
  }

  /**
   * @beta
   *
   * Generates a transaction to convert an activating stake account into mSOL,
   * while the remaining balance continues to be staked in its native form.
   *
   * Requirements:
   * - The stake's validator should be recognized by Marinade.
   * - The transaction should be executed immediately after being generated.
   *
   * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
   * @param {BN} solToKeep - Amount of SOL lamports to keep as a stake account
   */
  async depositActivatingStakeAccount(
    stakeAccountAddress: web3.PublicKey,
    solToKeep: BN
  ): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )

    const stakeAccountInfo = await getParsedStakeAccountInfo(
      this.provider,
      stakeAccountAddress
    )

    if (!stakeAccountInfo.stakedLamports) {
      throw new Error(
        `Stake account ${stakeAccountInfo.address} does not have staked lamports`
      )
    }

    const rent =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        web3.StakeProgram.space
      )
    const lamportsToWithdraw = stakeAccountInfo.stakedLamports
      .sub(solToKeep)
      .add(new BN(rent))

    const newStakeAccountKeypair = Keypair.generate()
    const transaction = new Transaction()

    if (solToKeep.gt(new BN(0))) {
      const splitStakeTx = StakeProgram.split({
        stakePubkey: stakeAccountAddress,
        authorizedPubkey: ownerAddress,
        splitStakePubkey: newStakeAccountKeypair.publicKey,
        lamports: solToKeep.toNumber(),
      })
      transaction.add(...splitStakeTx.instructions)
    }

    const deactivateTx = StakeProgram.deactivate({
      stakePubkey: stakeAccountAddress,
      authorizedPubkey: ownerAddress,
    })
    transaction.add(...deactivateTx.instructions)

    const withdrawTx = StakeProgram.withdraw({
      stakePubkey: stakeAccountAddress,
      authorizedPubkey: ownerAddress,
      toPubkey: ownerAddress,
      lamports: lamportsToWithdraw.toNumber(),
    })
    transaction.add(...withdrawTx.instructions)

    const { transaction: depositTx, associatedMSolTokenAccountAddress } =
      await this.deposit(lamportsToWithdraw)

    transaction.instructions.push(...depositTx.instructions)

    return {
      transaction,
      associatedMSolTokenAccountAddress,
      stakeAccountKeypair: solToKeep.gt(new BN(0))
        ? newStakeAccountKeypair
        : undefined,
    }
  }

  /**
   * Returns a transaction with the instructions to
   * Liquidate a delegated stake account.
   * Note that the stake must be fully activated and the validator must be known to Marinade
   * and that the transaction should be executed immediately after creation.
   *
   * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
   * @param {BN} mSolToKeep - Optional amount of mSOL lamports to keep
   */
  async liquidateStakeAccount(
    stakeAccountAddress: web3.PublicKey,
    mSolToKeep?: BN
  ): Promise<MarinadeResult.LiquidateStakeAccount> {
    const stakeAccountInfo = await getParsedStakeAccountInfo(
      this.provider,
      stakeAccountAddress
    )
    const rent =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        web3.StakeProgram.space
      )
    const marinadeState = await this.getMarinadeState()

    const {
      transaction: depositTx,
      associatedMSolTokenAccountAddress,
      voterAddress,
    } = await this.depositStakeAccountByAccount(
      stakeAccountInfo,
      rent,
      marinadeState
    )

    let mSolAmountToReceive = computeMsolAmount(
      stakeAccountInfo.stakedLamports ?? new BN(0),
      marinadeState
    )
    // when working with referral partner the costs of the deposit operation is subtracted from the mSOL amount the user receives
    if (this.isReferralProgram()) {
      const partnerOperationFee = (
        await this.marinadeReferralProgram.getReferralStateData()
      ).operationDepositStakeAccountFee
      mSolAmountToReceive = mSolAmountToReceive.sub(
        proportionalBN(
          mSolAmountToReceive,
          new BN(partnerOperationFee),
          new BN(10_000)
        )
      )
    }

    const unstakeAmountMSol = mSolAmountToReceive.sub(mSolToKeep ?? new BN(0))
    const { transaction: unstakeTx } = await this.liquidUnstake(
      unstakeAmountMSol,
      associatedMSolTokenAccountAddress
    )

    return {
      transaction: depositTx.add(unstakeTx),
      associatedMSolTokenAccountAddress,
      voterAddress,
    }
  }

  /**
   * @beta
   *
   * Returns a transaction with the instructions to
   * Partially liquidate a delegated stake account, while the rest remains staked natively.
   * Note that the stake must be fully activated and the validator must be known to Marinade
   * and that the transaction should be executed immediately after creation.
   *
   * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
   * @param {BN} solToKeep - Amount of SOL lamports to keep
   */
  async partiallyLiquidateStakeAccount(
    stakeAccountAddress: web3.PublicKey,
    solToKeep: BN
  ): Promise<MarinadeResult.PartiallyDepositStakeAccount> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )

    const stakeAccountInfo = await getParsedStakeAccountInfo(
      this.provider,
      stakeAccountAddress
    )

    const rent =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        web3.StakeProgram.space
      )

    const stakeToLiquidate = stakeAccountInfo.stakedLamports?.sub(solToKeep)
    if (!stakeToLiquidate || stakeToLiquidate.toNumber() < 1) {
      throw new Error("Can't liquidate less than 1 SOL")
    }

    const marinadeState = await this.getMarinadeState()
    const newStakeAccountKeypair = Keypair.generate()

    const splitStakeInstruction = StakeProgram.split({
      stakePubkey: stakeAccountAddress,
      authorizedPubkey: ownerAddress,
      splitStakePubkey: newStakeAccountKeypair.publicKey,
      lamports: solToKeep.toNumber(),
    })

    const {
      transaction: depositTx,
      associatedMSolTokenAccountAddress,
      voterAddress,
    } = await this.depositStakeAccountByAccount(
      stakeAccountInfo,
      rent,
      marinadeState
    )

    depositTx.instructions.unshift(...splitStakeInstruction.instructions)

    let mSolAmountToReceive = computeMsolAmount(stakeToLiquidate, marinadeState)
    // when working with referral partner the costs of the deposit operation is subtracted from the mSOL amount the user receives
    if (this.isReferralProgram()) {
      const partnerOperationFee = (
        await this.marinadeReferralProgram.getReferralStateData()
      ).operationDepositStakeAccountFee
      mSolAmountToReceive = mSolAmountToReceive.sub(
        proportionalBN(
          mSolAmountToReceive,
          new BN(partnerOperationFee),
          new BN(10_000)
        )
      )
    }

    const { transaction: unstakeTx } = await this.liquidUnstake(
      mSolAmountToReceive,
      associatedMSolTokenAccountAddress
    )

    return {
      transaction: depositTx.add(unstakeTx),
      associatedMSolTokenAccountAddress,
      stakeAccountKeypair: newStakeAccountKeypair,
      voterAddress,
    }
  }

  /**
   * Retrieve user's ticket accounts
   *
   * @param {web3.PublicKey} beneficiary - The owner of the ticket accounts
   */
  async getDelayedUnstakeTickets(
    beneficiary: web3.PublicKey
  ): Promise<Map<web3.PublicKey, TicketAccount>> {
    return this.marinadeFinanceProgram.getDelayedUnstakeTickets(beneficiary)
  }

  /**
   * Returns estimated Due date for an unstake ticket created now
   *
   */
  async getEstimatedUnstakeTicketDueDate() {
    const marinadeState = await this.getMarinadeState()
    return this.marinadeFinanceProgram.getEstimatedUnstakeTicketDueDate(
      marinadeState
    )
  }

  /**
   * Returns a transaction with the instructions to
   * Order Unstake to create a ticket which can be claimed later (with {@link claim}).
   *
   * @param {BN} msolAmount - The amount of mSOL in lamports to order for unstaking
   */
  async orderUnstake(msolAmount: BN): Promise<MarinadeResult.OrderUnstake> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const marinadeState = await this.getMarinadeState()

    const associatedMSolTokenAccountAddress =
      await getAssociatedTokenAccountAddress(
        marinadeState.mSolMintAddress,
        ownerAddress
      )
    const ticketAccountKeypair = web3.Keypair.generate()
    const rent =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        TICKET_ACCOUNT_SIZE
      )
    const createAccountInstruction = web3.SystemProgram.createAccount({
      fromPubkey: ownerAddress,
      newAccountPubkey: ticketAccountKeypair.publicKey,
      lamports: rent,
      space: TICKET_ACCOUNT_SIZE,
      programId: this.marinadeFinanceProgram.programAddress,
    })

    const program = this.marinadeFinanceProgram
    const orderUnstakeInstruction =
      await program.orderUnstakeInstructionBuilder({
        msolAmount,
        marinadeState,
        ownerAddress,
        associatedMSolTokenAccountAddress,
        newTicketAccount: ticketAccountKeypair.publicKey,
      })

    const transaction = new web3.Transaction().add(
      createAccountInstruction,
      orderUnstakeInstruction
    )

    return {
      ticketAccountKeypair,
      transaction,
      associatedMSolTokenAccountAddress,
    }
  }

  /**
   * Returns a transaction with the instructions to
   * Order Unstake to create a ticket which can be claimed later (with {@link claim}).
   *
   * @param {BN} msolAmount - The amount of mSOL in lamports to order for unstaking
   * @param {PublicKey} ticketAccountPublicKey - The public key of the ticket account that will sign the transaction
   */
  async orderUnstakeWithPublicKey(
    msolAmount: BN,
    ticketAccountPublicKey: PublicKey
  ): Promise<MarinadeResult.OrderUnstakeWithPublicKey> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const marinadeState = await this.getMarinadeState()

    const associatedMSolTokenAccountAddress =
      await getAssociatedTokenAccountAddress(
        marinadeState.mSolMintAddress,
        ownerAddress
      )
    const rent =
      await this.provider.connection.getMinimumBalanceForRentExemption(
        TICKET_ACCOUNT_SIZE
      )
    const createAccountInstruction = web3.SystemProgram.createAccount({
      fromPubkey: ownerAddress,
      newAccountPubkey: ticketAccountPublicKey,
      lamports: rent,
      space: TICKET_ACCOUNT_SIZE,
      programId: this.marinadeFinanceProgram.programAddress,
    })

    const program = this.marinadeFinanceProgram
    const orderUnstakeInstruction =
      await program.orderUnstakeInstructionBuilder({
        msolAmount,
        marinadeState,
        ownerAddress,
        associatedMSolTokenAccountAddress,
        newTicketAccount: ticketAccountPublicKey,
      })

    const transaction = new web3.Transaction().add(
      createAccountInstruction,
      orderUnstakeInstruction
    )

    return {
      transaction,
      associatedMSolTokenAccountAddress,
    }
  }

  /**
   * Returns a transaction with the instructions to
   * claim a ticket (created by {@link orderUnstake} beforehand).
   * Claimed SOLs will be sent to {@link MarinadeConfig.publicKey}.
   *
   * @param {web3.PublicKey} ticketAccount - Address of the ticket account for SOLs being claimed from
   */
  async claim(ticketAccount: web3.PublicKey): Promise<MarinadeResult.Claim> {
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )
    const marinadeState = await this.getMarinadeState()

    const program = this.marinadeFinanceProgram
    const claimInstruction = await program.claimInstructionBuilder({
      marinadeState,
      ticketAccount,
      transferSolTo: ownerAddress,
    })

    const transaction = new web3.Transaction().add(claimInstruction)

    return {
      transaction,
    }
  }

  /**
   * @beta
   *
   * Returns a transaction with the instructions to
   * Deposit an amount of stake pool tokens.
   *
   * This method is in beta stage. It may be changed or removed in future versions.
   *
   * @param {web3.PublicKey} stakePoolTokenAddress - The stake pool token account to be deposited
   * @param {number} amountToDeposit - Amount to deposit
   * @param {ValidatorStats[]} validators - List of validators to prio where to take the stake from
   */
  async depositStakePoolToken(
    stakePoolTokenAddress: web3.PublicKey,
    amountToDeposit: number,
    validators: ValidatorStats[]
  ): Promise<MarinadeResult.LiquidateStakePoolToken> {
    const marinadeState = await this.getMarinadeState()
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )

    const lookupTable = (
      await this.config.connection.getAddressLookupTable(
        this.config.lookupTableAddress
      )
    ).value
    if (!lookupTable) {
      throw new Error('Failed to load the lookup table')
    }

    const expectedSOL = await computeExpectedSOL(
      amountToDeposit,
      this.config.connection,
      stakePoolTokenAddress
    )

    // Due to our contract 1 SOL limit for Stake accounts we can't accept less than equivalent of 1 SOL
    if (expectedSOL / LAMPORTS_PER_SOL < 1) {
      throw new Error("Can't convert less than equivalent of 1 SOL")
    }

    const instructions: web3.TransactionInstruction[] = []

    const validatorSet = new Set(
      validators.filter(v => v.score).map(v => v.vote_account)
    )
    const withdrawTx = await withdrawStake(
      this.provider.connection,
      stakePoolTokenAddress,
      ownerAddress,
      amountToDeposit,
      undefined,
      undefined,
      undefined,
      undefined,
      (a: any, b: any) => selectSpecificValidator(a, b, validatorSet)
    )

    instructions.push(...withdrawTx.instructions)

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(
      this.provider,
      marinadeState.mSolMintAddress,
      ownerAddress
    )

    if (createAssociateTokenInstruction) {
      instructions.push(createAssociateTokenInstruction)
    }

    const { duplicationFlag, validatorIndex } = await identifyValidatorFromTx(
      withdrawTx.instructions,
      this.provider,
      marinadeState
    )

    const depositInstruction =
      await this.provideReferralOrMainProgram().depositStakeAccountInstructionBuilder(
        {
          validatorIndex,
          marinadeState,
          duplicationFlag,
          ownerAddress,
          stakeAccountAddress: withdrawTx.signers[1].publicKey,
          authorizedWithdrawerAddress: ownerAddress,
          associatedMSolTokenAccountAddress,
        }
      )

    instructions.push(depositInstruction)

    const { blockhash: recentBlockhash } =
      await this.config.connection.getLatestBlockhash('finalized')

    const transactionMessage = new web3.TransactionMessage({
      payerKey: ownerAddress,
      recentBlockhash,
      instructions,
    }).compileToV0Message([lookupTable])
    const transaction = new web3.VersionedTransaction(transactionMessage)
    transaction.sign(withdrawTx.signers)

    return {
      associatedMSolTokenAccountAddress,
      transaction,
    }
  }

  /**
   * @beta
   *
   * Returns a transaction with the instructions to
   * Liquidate an amount of stake pool tokens.
   *
   * This method is in beta stage. It may be changed or removed in future versions.
   *
   * @param {web3.PublicKey} stakePoolTokenAddress - The stake pool token account to be liquidated
   * @param {number} amountToLiquidate - Amount to liquidate
   * @param {ValidatorStats[]} validators - List of validators to prio where to take the stake from
   */
  async liquidateStakePoolToken(
    stakePoolTokenAddress: web3.PublicKey,
    amountToLiquidate: number,
    validators: ValidatorStats[]
  ): Promise<MarinadeResult.LiquidateStakePoolToken> {
    const marinadeState = await this.getMarinadeState()
    const ownerAddress = assertNotNullAndReturn(
      this.config.publicKey,
      ErrorMessage.NO_PUBLIC_KEY
    )

    const lookupTable = (
      await this.config.connection.getAddressLookupTable(
        this.config.lookupTableAddress
      )
    ).value
    if (!lookupTable) {
      throw new Error('Failed to load the lookup table')
    }

    const instructions: web3.TransactionInstruction[] = []

    const validatorSet = new Set(
      validators.filter(v => v.score).map(v => v.vote_account)
    )
    const withdrawTx = await withdrawStake(
      this.provider.connection,
      stakePoolTokenAddress,
      ownerAddress,
      amountToLiquidate,
      undefined,
      undefined,
      undefined,
      undefined,
      (a: any, b: any) => selectSpecificValidator(a, b, validatorSet)
    )

    const expectedSOL = await computeExpectedSOL(
      amountToLiquidate,
      this.config.connection,
      stakePoolTokenAddress
    )

    // Due to our contract 1 SOL limit for Stake accounts we can't accept less than equivalent of 1 SOL
    if (expectedSOL / LAMPORTS_PER_SOL < 1) {
      throw new Error("Can't convert less than equivalent of 1 SOL")
    }

    let mSolAmountToReceive = computeMsolAmount(
      new BN(expectedSOL),
      marinadeState
    )
    // when working with referral partner the costs of the deposit operation is subtracted from the mSOL amount the user receives
    if (this.isReferralProgram()) {
      const partnerOperationFee = (
        await this.marinadeReferralProgram.getReferralStateData()
      ).operationDepositStakeAccountFee
      mSolAmountToReceive = mSolAmountToReceive.sub(
        proportionalBN(
          mSolAmountToReceive,
          new BN(partnerOperationFee),
          new BN(10_000)
        )
      )
    }

    instructions.push(...withdrawTx.instructions)

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(
      this.provider,
      marinadeState.mSolMintAddress,
      ownerAddress
    )

    if (createAssociateTokenInstruction) {
      instructions.push(createAssociateTokenInstruction)
    }

    const { duplicationFlag, validatorIndex } = await identifyValidatorFromTx(
      withdrawTx.instructions,
      this.provider,
      marinadeState
    )

    const depositInstruction =
      await this.provideReferralOrMainProgram().depositStakeAccountInstructionBuilder(
        {
          validatorIndex,
          marinadeState,
          duplicationFlag,
          ownerAddress,
          stakeAccountAddress: withdrawTx.signers[1].publicKey,
          authorizedWithdrawerAddress: ownerAddress,
          associatedMSolTokenAccountAddress,
        }
      )

    const liquidUnstakeInstruction =
      await this.marinadeFinanceProgram.liquidUnstakeInstructionBuilder({
        amountLamports: mSolAmountToReceive,
        marinadeState,
        ownerAddress,
        associatedMSolTokenAccountAddress,
      })
    instructions.push(depositInstruction)
    instructions.push(liquidUnstakeInstruction)

    const { blockhash: recentBlockhash } =
      await this.config.connection.getLatestBlockhash('finalized')

    const transactionMessage = new web3.TransactionMessage({
      payerKey: ownerAddress,
      recentBlockhash,
      instructions,
    }).compileToV0Message([lookupTable])
    const transaction = new web3.VersionedTransaction(transactionMessage)
    transaction.sign(withdrawTx.signers)

    return {
      associatedMSolTokenAccountAddress,
      transaction,
    }
  }
}

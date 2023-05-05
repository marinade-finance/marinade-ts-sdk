import { MarinadeConfig } from './config/marinade-config'
import { BN, Provider, Wallet, web3 } from '@project-serum/anchor'
import { MarinadeState } from './marinade-state/marinade-state'
import {
  STAKE_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAccountAddress,
  getOrCreateAssociatedTokenAccount,
  getParsedStakeAccountInfo,
} from './util/anchor'
import { DepositOptions, ErrorMessage, MarinadeResult, ValidatorStats } from './marinade.types'
import { MarinadeFinanceProgram } from './programs/marinade-finance-program'
import { MarinadeReferralProgram } from './programs/marinade-referral-program'
import { MarinadeReferralPartnerState } from './marinade-referral-state/marinade-referral-partner-state'
import { MarinadeReferralGlobalState } from './marinade-referral-state/marinade-referral-global-state'
import { assertNotNullAndReturn } from './util/assert'
import { TicketAccount } from './marinade-state/borsh/ticket-account'
import { computeMsolAmount, ParsedStakeAccountInfo, proportionalBN, solToLamports } from './util'
import { getStakePoolAccount, StakePool, withdrawStake } from '@solana/spl-stake-pool'
import { ValidatorAccount } from '@solana/spl-stake-pool/dist/utils'

export function calcLamportsWithdrawAmount(
  stakePool: StakePool,
  poolTokens: BN
): BN {
  const numerator = poolTokens.mul(stakePool.totalLamports)
  const denominator = stakePool.poolTokenSupply
  if (numerator.lt(denominator)) {
    return new BN(0)
  }
  return numerator.div(denominator)
}

export class Marinade {
  constructor(public readonly config: MarinadeConfig = new MarinadeConfig()) { }

  readonly provider: Provider = new Provider(
    this.config.connection,
    new Wallet(web3.Keypair.generate()),
    { commitment: 'confirmed' },
  )

  /**
   * The main Marinade Program
   */
  readonly marinadeFinanceProgram = new MarinadeFinanceProgram(
    this.config.marinadeFinanceProgramId,
    this.provider,
  )

  /**
   * The Marinade Program for referral partners
   */
  readonly marinadeReferralProgram = new MarinadeReferralProgram(
    this.config.marinadeReferralProgramId,
    this.provider,
    this.config.referralCode,
    this,
  )

  private isReferralProgram(): boolean {
    return this.config.referralCode != null
  }

  private provideReferralOrMainProgram(): MarinadeFinanceProgram | MarinadeReferralProgram {
    return this.isReferralProgram() ? this.marinadeReferralProgram : this.marinadeFinanceProgram
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
  async getReferralPartnerState(referralCode?: web3.PublicKey): Promise<MarinadeReferralPartnerState> {
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
    const codes = accounts.map((acc) => acc.pubkey)
    return await Promise.all(
      codes.map((referralCode) => this.getReferralPartnerState(referralCode))
    )
  }

  /**
   * Returns a transaction with the instructions to
   * Add liquidity to the liquidity pool and receive LP tokens
   *
   * @param {BN} amountLamports - The amount of lamports added to the liquidity pool
   */
  async addLiquidity(amountLamports: BN): Promise<MarinadeResult.AddLiquidity> {
    const ownerAddress = assertNotNullAndReturn(this.config.publicKey, ErrorMessage.NO_PUBLIC_KEY)
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedLPTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.provider, marinadeState.lpMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const addLiquidityInstruction = this.marinadeFinanceProgram.addLiquidityInstruction({
      amountLamports,
      accounts: await this.marinadeFinanceProgram.addLiquidityInstructionAccounts({
        marinadeState,
        associatedLPTokenAccountAddress,
        ownerAddress,
      }),
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
  async removeLiquidity(amountLamports: BN): Promise<MarinadeResult.RemoveLiquidity> {
    const ownerAddress = assertNotNullAndReturn(this.config.publicKey, ErrorMessage.NO_PUBLIC_KEY)
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const associatedLPTokenAccountAddress = await getAssociatedTokenAccountAddress(marinadeState.lpMintAddress, ownerAddress)

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.provider, marinadeState.mSolMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const removeLiquidityInstruction = this.marinadeFinanceProgram.removeLiquidityInstruction({
      amountLamports,
      accounts: await this.marinadeFinanceProgram.removeLiquidityInstructionAccounts({
        marinadeState,
        ownerAddress,
        associatedLPTokenAccountAddress,
        associatedMSolTokenAccountAddress,
      }),
    })

    transaction.add(removeLiquidityInstruction)

    return {
      associatedLPTokenAccountAddress,
      associatedMSolTokenAccountAddress,
      transaction,
    }
  }

  /**
   * Returns a transaction with the instructions to
   * Stake SOL in exchange for mSOL
   *
   * @param {BN} amountLamports - The amount lamports staked
   * @param {DepositOptions=} options - Additional deposit options
   */
  async deposit(amountLamports: BN, options: DepositOptions = {}): Promise<MarinadeResult.Deposit> {
    const feePayer = assertNotNullAndReturn(this.config.publicKey, ErrorMessage.NO_PUBLIC_KEY)
    const mintToOwnerAddress = assertNotNullAndReturn(options.mintToOwnerAddress ?? this.config.publicKey, ErrorMessage.NO_PUBLIC_KEY)
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.provider, marinadeState.mSolMintAddress, mintToOwnerAddress, feePayer)

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
   * Returns a transaction with the instructions to
   * Swap your mSOL to get back SOL immediately using the liquidity pool
   *
   * @param {BN} amountLamports - The amount of mSOL exchanged for SOL
   */
  async liquidUnstake(amountLamports: BN, associatedMSolTokenAccountAddress?: web3.PublicKey): Promise<MarinadeResult.LiquidUnstake> {
    const ownerAddress = assertNotNullAndReturn(this.config.publicKey, ErrorMessage.NO_PUBLIC_KEY)
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    if (!associatedMSolTokenAccountAddress) {
      const associatedTokenAccountInfos = await getOrCreateAssociatedTokenAccount(this.provider, marinadeState.mSolMintAddress, ownerAddress)
      const createAssociateTokenInstruction = associatedTokenAccountInfos.createAssociateTokenInstruction
      associatedMSolTokenAccountAddress = associatedTokenAccountInfos.associatedTokenAccountAddress

      if (createAssociateTokenInstruction) {
        transaction.add(createAssociateTokenInstruction)
      }
    }

    const program = this.provideReferralOrMainProgram()
    const liquidUnstakeInstruction = await program.liquidUnstakeInstructionBuilder({
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
  async depositStakeAccount(stakeAccountAddress: web3.PublicKey): Promise<MarinadeResult.DepositStakeAccount> {
    const stakeAccountInfo = await getParsedStakeAccountInfo(this.provider, stakeAccountAddress)
    const marinadeState = await this.getMarinadeState()
    const rent = await this.provider.connection.getMinimumBalanceForRentExemption(web3.StakeProgram.space)

    return this.depositStakeAccountByAccount(stakeAccountInfo, rent, marinadeState)
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
  async depositStakeAccountByAccount(stakeAccountInfo: ParsedStakeAccountInfo, rent: number, marinadeState: MarinadeState): Promise<MarinadeResult.DepositStakeAccount> {
    const ownerAddress = assertNotNullAndReturn(this.config.publicKey, ErrorMessage.NO_PUBLIC_KEY)
    const transaction = new web3.Transaction()
    const currentEpoch = await this.provider.connection.getEpochInfo()

    const { authorizedWithdrawerAddress, voterAddress, activationEpoch, isCoolingDown, stakedLamports, balanceLamports } = stakeAccountInfo

    if (!authorizedWithdrawerAddress) {
      throw new Error('Withdrawer address is not available!')
    }

    if (!activationEpoch || !voterAddress) {
      throw new Error('The stake account is not delegated!')
    }

    if (isCoolingDown) {
      throw new Error('The stake is cooling down!')
    }

    if (stakedLamports && balanceLamports?.gt(stakedLamports)) {
      const lamportsToWithdraw = balanceLamports.sub(stakedLamports).toNumber() - rent
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
      throw new Error(`Deposited stake ${stakeAccountInfo.address} is not activated yet. Wait for #${earliestDepositEpoch} epoch`)
    }

    const { validatorRecords } = await marinadeState.getValidatorRecords()
    const validatorLookupIndex = validatorRecords.findIndex(({ validatorAccount }) => validatorAccount.equals(voterAddress))
    const validatorIndex = validatorLookupIndex === -1 ? marinadeState.state.validatorSystem.validatorList.count : validatorLookupIndex

    const duplicationFlag = await marinadeState.validatorDuplicationFlag(voterAddress)

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.provider, marinadeState.mSolMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const program = this.provideReferralOrMainProgram()
    const depositStakeAccountInstruction = await program.depositStakeAccountInstructionBuilder({
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
   * Returns a transaction with the instructions to
   * Liquidate a delegated stake account.
   * Note that the stake must be fully activated and the validator must be known to Marinade
   * and that the transaction should be executed immediately after creation.
   *
   * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
   * @param {BN} mSolToKeep - Optional amount of mSOL lamports to keep
   */
  async liquidateStakeAccount(stakeAccountAddress: web3.PublicKey, mSolToKeep?: BN): Promise<MarinadeResult.LiquidateStakeAccount> {
    const stakeAccountInfo = await getParsedStakeAccountInfo(this.provider, stakeAccountAddress)
    const rent = await this.provider.connection.getMinimumBalanceForRentExemption(web3.StakeProgram.space)
    const marinadeState = await this.getMarinadeState()

    const { transaction: depositTx, associatedMSolTokenAccountAddress, voterAddress } = 
      await this.depositStakeAccountByAccount(stakeAccountInfo, rent, marinadeState)

    let mSolAmountToReceive = computeMsolAmount((stakeAccountInfo.stakedLamports ?? new BN(0)), marinadeState)
    // when working with referral partner the costs of the deposit operation is subtracted from the mSOL amount the user receives
    if (this.isReferralProgram()) {
      const partnerOperationFee = (await this.marinadeReferralProgram.getReferralStateData()).operationDepositStakeAccountFee
      mSolAmountToReceive = mSolAmountToReceive.sub(proportionalBN(mSolAmountToReceive, new BN(partnerOperationFee), new BN(10_000)))
    }

    const unstakeAmountMSol = mSolAmountToReceive.sub(mSolToKeep ?? new BN(0))
    const { transaction: unstakeTx } = await this.liquidUnstake(unstakeAmountMSol, associatedMSolTokenAccountAddress)

    return {
      transaction: depositTx.add(unstakeTx),
      associatedMSolTokenAccountAddress,
      voterAddress,
    }
  }

  selectSpecificValidator(a: ValidatorAccount, b: ValidatorAccount, validators: Set<string>) {
    const scoredValidatorA = a.voteAddress ? validators.has(a.voteAddress.toString()) : false
    const scoredValidatorB = b.voteAddress ? validators.has(b.voteAddress.toString()) : false
    return (scoredValidatorB ? b.lamports : 0) - (scoredValidatorA ? a.lamports : 0)
  }

  /**
   * Returns a transaction with the instructions to
   * Liquidate an amount of stake pool tokens.
   *
   * @param {web3.PublicKey} stakePoolTokenAddress - The stake pool token account to be liquidated
   * @param {BN} amountToLiquidate - Amount to liquidate
   */
  async liquidateStakePoolToken(stakePoolTokenAddress: web3.PublicKey, amountToLiquidate: number, validators: ValidatorStats[]): Promise<MarinadeResult.LiquidateStakePoolToken> {
    const marinadeState = await this.getMarinadeState()
    const ownerAddress = assertNotNullAndReturn(this.config.publicKey, ErrorMessage.NO_PUBLIC_KEY)
    const rent = await this.provider.connection.getMinimumBalanceForRentExemption(web3.StakeProgram.space)
    const lookupTable = await this.getLookupTable()
    if (!lookupTable) {
      throw new Error('Failed to load the lookup table')
    }

    const { blockhash: recentBlockhash } = await this.config.connection.getLatestBlockhash('finalized')

    const instructions: web3.TransactionInstruction[] = []

    const validatorSet = new Set(validators.filter((v) => v.score).map((v) => v.vote_account))
    const withdrawTx = await withdrawStake(
      this.provider.connection,
      stakePoolTokenAddress,
      ownerAddress,
      amountToLiquidate,
      undefined,
      undefined,
      undefined,
      undefined,
      (a, b) => this.selectSpecificValidator(a, b, validatorSet)
    )

    const stakePool = await getStakePoolAccount(this.provider.connection, stakePoolTokenAddress)
    const solValue = calcLamportsWithdrawAmount(
      stakePool.account.data,
      solToLamports(amountToLiquidate)
    )
    const mSolAmountToReceive = computeMsolAmount(solValue.sub(new BN(rent)), marinadeState)

    instructions.push(...withdrawTx.instructions)
    const withdrawTxAccounts = withdrawTx.instructions.flatMap((i) => i.keys.map((k) => k.pubkey.toString()))

    const excludedAccounts = [web3.SYSVAR_CLOCK_PUBKEY.toString(), STAKE_PROGRAM_ID.toString(), TOKEN_PROGRAM_ID.toString()]
    const uniqueAccounts = withdrawTxAccounts.filter((value, index, self) => {
      return self.indexOf(value) === index && self.lastIndexOf(value) === index && !excludedAccounts.includes(value)
    })

    let originValidatorAddress = ""
    await Promise.all(uniqueAccounts.map(async(acc) => {
      try {
        const accountInfo = await getParsedStakeAccountInfo(this.provider, new web3.PublicKey(acc))
        if (accountInfo.voterAddress) originValidatorAddress = accountInfo.voterAddress.toString()
      } catch { /* empty */ }
    }))

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.provider, marinadeState.mSolMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      instructions.push(createAssociateTokenInstruction)
    }

    const duplicationFlag = await marinadeState.validatorDuplicationFlag(
      new web3.PublicKey(
        originValidatorAddress
      )
    )
    const { validatorRecords } = await marinadeState.getValidatorRecords()
    const validatorLookupIndex = validatorRecords.findIndex(
      ({ validatorAccount }) => validatorAccount.equals(new web3.PublicKey(
        originValidatorAddress
      ))
    )
    const validatorIndex =
      validatorLookupIndex === -1
        ? marinadeState.state.validatorSystem.validatorList.count
        : validatorLookupIndex

    const depositInstruction = await this.marinadeFinanceProgram.depositStakeAccountInstructionBuilder({
      validatorIndex,
      marinadeState,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress: withdrawTx.signers[1].publicKey,
      authorizedWithdrawerAddress: ownerAddress,
      associatedMSolTokenAccountAddress,
    })

    const liquidUnstakeInstruction = await this.marinadeFinanceProgram.liquidUnstakeInstructionBuilder({
      amountLamports: mSolAmountToReceive,
      marinadeState,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })
    instructions.push(depositInstruction)
    instructions.push(liquidUnstakeInstruction)

    const transactionMessage = new web3.TransactionMessage({
      payerKey: ownerAddress,
      recentBlockhash,
      instructions,
    }).compileToV0Message([lookupTable])
    const transaction = new web3.VersionedTransaction(transactionMessage)
    transaction.sign(withdrawTx.signers)

    return {
      transaction,
      associatedMSolTokenAccountAddress,
      voterAddress: stakePoolTokenAddress,
    }
  }

  /**
   * Retrieve user's ticket accounts
   * 
   * @param {web3.PublicKey} beneficiary - The owner of the ticket accounts
   */
  async getDelayedUnstakeTickets(beneficiary: web3.PublicKey): Promise<Map<web3.PublicKey, TicketAccount>> {
    return this.marinadeFinanceProgram.getDelayedUnstakeTickets(beneficiary)
  }

  /**
   * Returns estimated Due date for an unstake ticket created now
   *
   */
  async getEstimatedUnstakeTicketDueDate() {
    const marinadeState = await this.getMarinadeState()
    return this.marinadeFinanceProgram.getEstimatedUnstakeTicketDueDate(marinadeState)
  }

  async getLookupTable(): Promise<web3.AddressLookupTableAccount | null> {
    return (await this.config.connection.getAddressLookupTable(this.config.lookupTableAddress)).value
  }
}

import { MarinadeConfig } from './modules/marinade-config'
import { BN, Provider, Wallet, web3 } from '@project-serum/anchor'
import { MarinadeState } from './marinade-state/marinade-state'
import { getAssociatedTokenAccountAddress, getOrCreateAssociatedTokenAccount, getParsedStakeAccountInfo } from './util/anchor'
import { MarinadeResult } from './marinade.types'
import { MarinadeFinanceProgram } from './programs/marinade-finance-program'
import { MarinadeReferralProgram } from './programs/marinade-referral-program'

export class Marinade {
  constructor(public readonly config: MarinadeConfig = new MarinadeConfig()) { }

  readonly anchorProvider = new Provider(
    new web3.Connection(this.config.anchorProviderUrl),
    new Wallet(this.config.wallet),
    { commitment: 'confirmed' },
  )

  /**
   * The main Marinade Program
   */
  readonly marinadeFinanceProgram = new MarinadeFinanceProgram(
    this.config.marinadeFinanceProgramId,
    this.anchorProvider,
  )

  /**
   * The Marinade Program for referral partners
   */
  readonly marinadeReferralProgram = this.config.referralCode
    ? new MarinadeReferralProgram(
      this.config.marinadeReferralProgramId,
      this.anchorProvider,
      this.config.referralCode,
    )
    : null

  /**
   * Fetch the Marinade's internal state
   */
  async getMarinadeState(): Promise<MarinadeState> {
    return MarinadeState.fetch(this)
  }

  /**
   * Add liquidity to the liquidity pool and receive LP tokens
   *
   * @param {BN} amountLamports - The amount of lamports added to the liquidity pool
   */
  async addLiquidity(amountLamports: BN): Promise<MarinadeResult.AddLiquidity> {
    const ownerAddress = this.config.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedLPTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.anchorProvider, marinadeState.lpMintAddress, ownerAddress)

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
    const transactionSignature = await this.anchorProvider.send(transaction)

    return {
      associatedLPTokenAccountAddress,
      transactionSignature,
    }
  }

  /**
   * Burn LP tokens and get SOL and mSOL back from the liquidity pool
   *
   * @param {BN} amountLamports - The amount of LP tokens burned
   */
  async removeLiquidity(amountLamports: BN): Promise<MarinadeResult.RemoveLiquidity> {
    const ownerAddress = this.config.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const associatedLPTokenAccountAddress = await getAssociatedTokenAccountAddress(marinadeState.lpMintAddress, ownerAddress)

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.anchorProvider, marinadeState.mSolMintAddress, ownerAddress)

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
    const transactionSignature = await this.anchorProvider.send(transaction)

    return {
      associatedLPTokenAccountAddress,
      associatedMSolTokenAccountAddress,
      transactionSignature,
    }
  }

  /**
   * Stake SOL in exchange for mSOL
   *
   * @param {BN} amountLamports - The amount lamports staked
   */
  async deposit(amountLamports: BN): Promise<MarinadeResult.Deposit> {
    const ownerAddress = this.config.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.anchorProvider, marinadeState.mSolMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const program = this.marinadeReferralProgram ?? this.marinadeFinanceProgram
    const depositInstruction = await program.depositInstructionBuilder({
      amountLamports,
      marinadeState,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })

    transaction.add(depositInstruction)
    const transactionSignature = await this.anchorProvider.send(transaction)

    return {
      associatedMSolTokenAccountAddress,
      transactionSignature,
    }
  }

  /**
   * Swap your mSOL to get back SOL immediately using the liquidity pool
   *
   * @param {BN} amountLamports - The amount of mSOL exchanged for SOL
   */
  async liquidUnstake(amountLamports: BN): Promise<MarinadeResult.LiquidUnstake> {
    const ownerAddress = this.config.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.anchorProvider, marinadeState.mSolMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const program = this.marinadeReferralProgram ?? this.marinadeFinanceProgram
    const liquidUnstakeInstruction = await program.liquidUnstakeInstructionBuilder({
      amountLamports,
      marinadeState,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })

    transaction.add(liquidUnstakeInstruction)
    const transactionSignature = await this.anchorProvider.send(transaction)

    return {
      associatedMSolTokenAccountAddress,
      transactionSignature,
    }
  }

  /**
   * Deposit delegated stake account.
   * Note that the stake must be fully activated and the validator must be known to Marinade
   *
   * @param {web3.PublicKey} stakeAccountAddress - The account to be deposited
   */
  async depositStakeAccount(stakeAccountAddress: web3.PublicKey): Promise<MarinadeResult.DepositStakeAccount> {
    const ownerAddress = this.config.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()
    const currentEpoch = await this.anchorProvider.connection.getEpochInfo()
    const stakeAccountInfo = await getParsedStakeAccountInfo(this.anchorProvider, stakeAccountAddress)

    const { authorizedWithdrawerAddress, voterAddress, activationEpoch, isCoolingDown } = stakeAccountInfo

    if (!authorizedWithdrawerAddress) {
      throw new Error('Withdrawer address is not available!')
    }

    if (!activationEpoch || !voterAddress) {
      throw new Error('The stake account is not delegated!')
    }

    if (isCoolingDown) {
      throw new Error('The stake is cooling down!')
    }

    const waitEpochs = 2
    const earliestDepositEpoch = activationEpoch.addn(waitEpochs)
    if (earliestDepositEpoch.gtn(currentEpoch.epoch)) {
      throw new Error(`Deposited stake ${stakeAccountAddress} is not activated yet. Wait for #${earliestDepositEpoch} epoch`)
    }

    const { validatorRecords } = await marinadeState.getValidatorRecords()
    const validatorLookupIndex = validatorRecords.findIndex(({ validatorAccount }) => validatorAccount.equals(voterAddress))
    const validatorIndex = validatorLookupIndex === -1 ? marinadeState.state.validatorSystem.validatorList.count : validatorLookupIndex

    const duplicationFlag = await marinadeState.validatorDuplicationFlag(voterAddress)

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.anchorProvider, marinadeState.mSolMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const program = this.marinadeReferralProgram ?? this.marinadeFinanceProgram
    const depositStakeAccountInstruction = await program.depositStakeAccountInstructionBuilder({
      validatorIndex,
      marinadeState,
      duplicationFlag,
      authorizedWithdrawerAddress,
      associatedMSolTokenAccountAddress,
      ownerAddress,
      stakeAccountAddress,
    })

    transaction.add(depositStakeAccountInstruction)

    const transactionSignature = await this.anchorProvider.send(transaction)
    return {
      associatedMSolTokenAccountAddress,
      voterAddress,
      transactionSignature,
    }
  }
}

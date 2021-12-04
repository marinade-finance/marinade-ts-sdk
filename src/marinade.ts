import { MarinadeConfig } from './config/marinade-config'
import { BN, web3 } from '@project-serum/anchor'
import { MarinadeState } from './marinade-state/marinade-state'
import { getAssociatedTokenAccountAddress, getOrCreateAssociatedTokenAccount, getParsedStakeAccountInfo } from './util/anchor'
import { MarinadeResult } from './marinade.types'
import { MarinadeFinanceProgram } from './programs/marinade-finance-program'
import { MarinadeReferralProgram } from './programs/marinade-referral-program'
import { MarinadeReferralPartnerState } from './marinade-referral-state/marinade-referral-partner-state'
import { MarinadeReferralGlobalState } from './marinade-referral-state/marinade-referral-global-state'

export class Marinade {
  constructor(public readonly config: MarinadeConfig = new MarinadeConfig()) { }

  /**
   * The main Marinade Program
   */
  readonly marinadeFinanceProgram = new MarinadeFinanceProgram(
    this.config.marinadeFinanceProgramId,
    this.config.provider,
  )

  /**
   * The Marinade Program for referral partners
   */
  readonly marinadeReferralProgram = new MarinadeReferralProgram(
    this.config.marinadeReferralProgramId,
    this.config.provider,
    this.config.referralCode,
  )

  private provideReferralOrMainProgram(): MarinadeFinanceProgram | MarinadeReferralProgram {
    return this.config.referralCode ? this.marinadeReferralProgram: this.marinadeFinanceProgram
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
  async getReferralPartnerState(): Promise<MarinadeReferralPartnerState> {
    return MarinadeReferralPartnerState.fetch(this)
  }

  /**
   * Fetch the Marinade referral program's global state
   */
  async getReferralGlobalState(): Promise<MarinadeReferralGlobalState> {
    return MarinadeReferralGlobalState.fetch(this)
  }

  /**
   * Add liquidity to the liquidity pool and receive LP tokens
   *
   * @param {BN} amountLamports - The amount of lamports added to the liquidity pool
   */
  async addLiquidity(amountLamports: BN): Promise<MarinadeResult.AddLiquidity> {
    const ownerAddress = this.config.provider.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedLPTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.config.provider, marinadeState.lpMintAddress, ownerAddress)

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
    const transactionSignature = await this.config.provider.send(transaction)

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
    const ownerAddress = this.config.provider.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const associatedLPTokenAccountAddress = await getAssociatedTokenAccountAddress(marinadeState.lpMintAddress, ownerAddress)

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.config.provider, marinadeState.mSolMintAddress, ownerAddress)

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
    const transactionSignature = await this.config.provider.send(transaction)

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
    const ownerAddress = this.config.provider.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.config.provider, marinadeState.mSolMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const program = this.provideReferralOrMainProgram()
    const depositInstruction = await program.depositInstructionBuilder({
      amountLamports,
      marinadeState,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })

    transaction.add(depositInstruction)
    const transactionSignature = await this.config.provider.send(transaction)

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
    const ownerAddress = this.config.provider.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()

    const {
      associatedTokenAccountAddress: associatedMSolTokenAccountAddress,
      createAssociateTokenInstruction,
    } = await getOrCreateAssociatedTokenAccount(this.config.provider, marinadeState.mSolMintAddress, ownerAddress)

    if (createAssociateTokenInstruction) {
      transaction.add(createAssociateTokenInstruction)
    }

    const program = this.provideReferralOrMainProgram()
    const liquidUnstakeInstruction = await program.liquidUnstakeInstructionBuilder({
      amountLamports,
      marinadeState,
      ownerAddress,
      associatedMSolTokenAccountAddress,
    })

    transaction.add(liquidUnstakeInstruction)
    const transactionSignature = await this.config.provider.send(transaction)

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
    const ownerAddress = this.config.provider.wallet.publicKey
    const marinadeState = await this.getMarinadeState()
    const transaction = new web3.Transaction()
    const currentEpoch = await this.config.provider.connection.getEpochInfo()
    const stakeAccountInfo = await getParsedStakeAccountInfo(this.config.provider, stakeAccountAddress)

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
    } = await getOrCreateAssociatedTokenAccount(this.config.provider, marinadeState.mSolMintAddress, ownerAddress)

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
      stakeAccountAddress,
    })

    transaction.add(depositStakeAccountInstruction)

    const transactionSignature = await this.config.provider.send(transaction)
    return {
      associatedMSolTokenAccountAddress,
      voterAddress,
      transactionSignature,
    }
  }
}

import { MarinadeConfig } from './modules/marinade-config'
import { BN, Idl, Program, Provider, Wallet, web3 } from '@project-serum/anchor'
import * as marinadeFinanceIdl from './idl/marinade-finance-idl.json'
import * as marinadeReferralIdl from './idl/marinade-referral-idl.json'
import { MarinadeState } from './marinade-state/marinade-state'
import { getAssociatedTokenAccountAddress, getOrCreateAssociatedTokenAccount, getParsedStakeAccountInfo } from './util/anchor'
import { MarinadeResult } from './marinade.types'
import * as MarinadeFinanceAccounts from './idl/marinade-finance-accounts'
import * as MarinadeInstructions from './idl/marinade-instructions'

export class Marinade {
  constructor (public readonly config: MarinadeConfig = new MarinadeConfig()) { }

  readonly anchorProvider = new Provider(
    new web3.Connection(this.config.anchorProviderUrl),
    new Wallet(this.config.wallet),
    { commitment: 'confirmed' },
  )

  /**
   * The main Marinade Program
   */
  get marinadeFinanceProgram (): Program {
    return new Program(
      marinadeFinanceIdl as Idl,
      this.config.marinadeFinanceProgramId,
      this.anchorProvider,
    )
  }

  /**
   * The Marinade Program for referral partners
   */
  get marinadeReferralProgram (): Program {
    return new Program(
      marinadeReferralIdl as Idl,
      this.config.marinadeReferralProgramId,
      this.anchorProvider,
    )
  }

  /**
   * Fetch the Marinade's internal state
   */
  async getMarinadeState (): Promise<MarinadeState> {
    return MarinadeState.fetch(this)
  }

  /**
   * Add liquidity to the liquidity pool and receive LP tokens
   *
   * @param {BN} amountLamports - The amount of lamports added to the liquidity pool
   */
  async addLiquidity (amountLamports: BN): Promise<MarinadeResult.AddLiquidity> {
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

    const addLiquidityInstruction = MarinadeInstructions.addLiquidityInstruction({
      program: this.marinadeFinanceProgram,
      amountLamports,
      accounts: await MarinadeFinanceAccounts.addLiquidityAccounts({
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
  async removeLiquidity (amountLamports: BN): Promise<MarinadeResult.RemoveLiquidity> {
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

    const removeLiquidityInstruction = MarinadeInstructions.removeLiquidityInstruction({
      program: this.marinadeFinanceProgram,
      amountLamports,
      accounts: await MarinadeFinanceAccounts.removeLiquidityAccounts({
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
  async deposit (amountLamports: BN): Promise<MarinadeResult.Deposit> {
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

    const depositInstruction = MarinadeInstructions.depositInstruction({
      program: this.marinadeFinanceProgram,
      amountLamports,
      accounts: await MarinadeFinanceAccounts.depositAccounts({
        marinadeState,
        ownerAddress,
        associatedMSolTokenAccountAddress,
      }),
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
  async liquidUnstake (amountLamports: BN): Promise<MarinadeResult.LiquidUnstake> {
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

    const liquidUnstakeInstruction = MarinadeInstructions.liquidUnstakeInstruction({
      program: this.marinadeFinanceProgram,
      amountLamports,
      accounts: await MarinadeFinanceAccounts.liquidUnstakeAccounts({
        marinadeState,
        ownerAddress,
        associatedMSolTokenAccountAddress,
      }),
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
  async depositStakeAccount (stakeAccountAddress: web3.PublicKey): Promise<MarinadeResult.DepositStakeAccount> {
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

    const depositStakeAccountInstruction = MarinadeInstructions.depositStakeAccountInstruction({
      program: this.marinadeFinanceProgram,
      validatorIndex,
      accounts: await MarinadeFinanceAccounts.depositStakeAccountAccounts({
        marinadeState,
        duplicationFlag,
        authorizedWithdrawerAddress,
        associatedMSolTokenAccountAddress,
        ownerAddress,
        stakeAccountAddress,
      }),
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

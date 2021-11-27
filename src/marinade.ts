import { MarinadeConfig } from './modules/marinade-config'
import { BN, Idl, Program, Provider, Wallet, web3 } from '@project-serum/anchor'
import * as marinadeIdl from './marinade-idl.json'
import { MarinadeState } from './marinade-state/marinade-state'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { getAssociatedTokenAccountAddress, getOrCreateAssociatedTokenAccount, getParsedStakeAccountInfo, STAKE_PROGRAM_ID, SYSTEM_PROGRAM_ID } from './util/anchor'
import { MarinadeResult } from './marinade.types'

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
  get marinadeProgram(): Program {
    return new Program(
      marinadeIdl as Idl,
      this.config.marinadeProgramId,
      this.anchorProvider,
    )
  }

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

    const addLiquidityInstruction = await this.marinadeProgram.instruction.addLiquidity(
      amountLamports,
      {
        accounts: {
          state: this.config.marinadeStateAddress,
          lpMint: marinadeState.lpMintAddress,
          lpMintAuthority: await marinadeState.lpMintAuthority(),
          liqPoolMsolLeg: marinadeState.mSolLeg,
          liqPoolSolLegPda: await marinadeState.solLeg(),
          transferFrom: ownerAddress,
          mintTo: associatedLPTokenAccountAddress,
          systemProgram: SYSTEM_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )

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
    const removeLiquidityInstruction = await this.marinadeProgram.instruction.removeLiquidity(
      amountLamports,
      {
        accounts: {
          state: this.config.marinadeStateAddress,
          lpMint: marinadeState.lpMintAddress,
          burnFrom: associatedLPTokenAccountAddress,
          burnFromAuthority: this.config.wallet.publicKey,
          liqPoolSolLegPda: await marinadeState.solLeg(),
          transferSolTo: ownerAddress,
          transferMsolTo: associatedMSolTokenAccountAddress,
          liqPoolMsolLeg: marinadeState.mSolLeg,
          liqPoolMsolLegAuthority: await marinadeState.mSolLegAuthority(),
          systemProgram: SYSTEM_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )

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

    const depositInstruction = await this.marinadeProgram.instruction.deposit(
      amountLamports,
      {
        accounts: {
          reservePda: await marinadeState.reserveAddress(),
          state: this.config.marinadeStateAddress,
          msolMint: marinadeState.mSolMintAddress,
          msolMintAuthority: await marinadeState.mSolMintAuthority(),
          liqPoolMsolLegAuthority: await marinadeState.mSolLegAuthority(),
          liqPoolMsolLeg: marinadeState.mSolLeg,
          liqPoolSolLegPda: await marinadeState.solLeg(),
          mintTo: associatedMSolTokenAccountAddress,
          transferFrom: ownerAddress,
          systemProgram: SYSTEM_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )

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

    const liquidUnstakeInstruction = await this.marinadeProgram.instruction.liquidUnstake(
      amountLamports,
      {
        accounts: {
          state: this.config.marinadeStateAddress,
          msolMint: marinadeState.mSolMintAddress,
          liqPoolMsolLeg: marinadeState.mSolLeg,
          liqPoolSolLegPda: await marinadeState.solLeg(),
          getMsolFrom: associatedMSolTokenAccountAddress,
          getMsolFromAuthority: ownerAddress,
          transferSolTo: ownerAddress,
          treasuryMsolAccount: marinadeState.treasuryMsolAccount,
          systemProgram: SYSTEM_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      }
    )

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

    const validatorRecords = await marinadeState.getValidatorRecords()
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

    const depositStakeAccountInstruction = await this.marinadeProgram.instruction.depositStakeAccount(
      validatorIndex,
      {
        accounts: {
          duplicationFlag,
          stakeAuthority: authorizedWithdrawerAddress,
          state: this.config.marinadeStateAddress,
          stakeList: marinadeState.state.stakeSystem.stakeList.account,
          stakeAccount: stakeAccountAddress,
          validatorList: marinadeState.state.validatorSystem.validatorList.account,
          msolMint: marinadeState.mSolMintAddress,
          msolMintAuthority: await marinadeState.mSolMintAuthority(),
          mintTo: associatedMSolTokenAccountAddress,
          rentPayer: ownerAddress,
          clock: SYSVAR_CLOCK_PUBKEY,
          rent: SYSVAR_RENT_PUBKEY,
          systemProgram: SYSTEM_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          stakeProgram: STAKE_PROGRAM_ID,
        },
      }
    )
    transaction.add(depositStakeAccountInstruction)

    const transactionSignature = await this.anchorProvider.send(transaction)
    return {
      associatedMSolTokenAccountAddress,
      voterAddress,
      transactionSignature,
    }
  }
}

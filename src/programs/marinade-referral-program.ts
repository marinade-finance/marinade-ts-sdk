import { BN, Idl, Program, Provider, web3 } from '@project-serum/anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { MarinadeState } from '../marinade-state/marinade-state'
import { STAKE_PROGRAM_ID, SYSTEM_PROGRAM_ID } from '../util'
import { MarinadeReferralIdl } from './idl/marinade-referral-idl'
import * as marinadeReferralIdlSchema from './idl/marinade-referral-idl.json'

export class MarinadeReferralProgram {
  constructor (
    public readonly programAddress: web3.PublicKey,
    public readonly anchorProvider: Provider,
    public readonly referralState: web3.PublicKey,
  ) { }

  get program (): Program {
    return new Program(
      marinadeReferralIdlSchema as Idl,
      this.programAddress,
      this.anchorProvider,
    )
  }

  liquidUnstakeInstructionAccounts = async ({ marinadeState, ownerAddress, associatedMSolTokenAccountAddress }: {
    marinadeState: MarinadeState,
    ownerAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeReferralIdl.Instruction.LiquidUnstake.Accounts> => ({
    marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
    marinadeFinanceState: marinadeState.marinadeStateAddress,
    referralState: this.referralState,
    msolMint: marinadeState.mSolMintAddress,
    liqPoolMsolLeg: marinadeState.mSolLeg,
    liqPoolSolLegPda: await marinadeState.solLeg(),
    getMsolFrom: associatedMSolTokenAccountAddress,
    getMsolFromAuthority: ownerAddress,
    transferSolTo: ownerAddress,
    treasuryMsolAccount: marinadeState.treasuryMsolAccount,
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  liquidUnstakeInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeReferralIdl.Instruction.LiquidUnstake.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.liquidUnstake(
    amountLamports,
    { accounts }
  )

  liquidUnstakeInstructionBuilder = async ({ amountLamports, ...accountsArgs }: { amountLamports: BN } & Parameters<this['liquidUnstakeInstructionAccounts']>[0]) =>
    this.liquidUnstakeInstruction({
      amountLamports,
      accounts: await this.liquidUnstakeInstructionAccounts(accountsArgs),
    })

  depositInstructionAccounts = async ({ marinadeState, ownerAddress, associatedMSolTokenAccountAddress }: {
    marinadeState: MarinadeState,
    ownerAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeReferralIdl.Instruction.Deposit.Accounts> => ({
    reservePda: await marinadeState.reserveAddress(),
    marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
    referralState: this.referralState,
    state: marinadeState.marinadeStateAddress,
    msolMint: marinadeState.mSolMintAddress,
    msolMintAuthority: await marinadeState.mSolMintAuthority(),
    liqPoolMsolLegAuthority: await marinadeState.mSolLegAuthority(),
    liqPoolMsolLeg: marinadeState.mSolLeg,
    liqPoolSolLegPda: await marinadeState.solLeg(),
    mintTo: associatedMSolTokenAccountAddress,
    transferFrom: ownerAddress,
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
  })

  depositInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeReferralIdl.Instruction.Deposit.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.deposit(
    amountLamports,
    { accounts }
  )

  depositInstructionBuilder = async ({ amountLamports, ...accountsArgs }: { amountLamports: BN } & Parameters<this['depositInstructionAccounts']>[0]) =>
    this.depositInstruction({
      amountLamports,
      accounts: await this.depositInstructionAccounts(accountsArgs),
    })

  depositStakeAccountInstructionAccounts = async ({
    marinadeState,
    duplicationFlag,
    ownerAddress,
    stakeAccountAddress,
    authorizedWithdrawerAddress,
    associatedMSolTokenAccountAddress,
  }: {
    marinadeState: MarinadeState,
    duplicationFlag: web3.PublicKey,
    ownerAddress: web3.PublicKey,
    stakeAccountAddress: web3.PublicKey,
    authorizedWithdrawerAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeReferralIdl.Instruction.DepositStakeAccount.Accounts> => ({
    duplicationFlag,
    stakeAuthority: authorizedWithdrawerAddress,
    marinadeFinanceState: marinadeState.marinadeStateAddress,
    marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
    referralState: this.referralState,
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
  })

  depositStakeAccountInstruction = ({ accounts, validatorIndex }: {
    accounts: MarinadeReferralIdl.Instruction.DepositStakeAccount.Accounts,
    validatorIndex: number,
  }): web3.TransactionInstruction => this.program.instruction.depositStakeAccount(
    validatorIndex,
    { accounts },
  )

  depositStakeAccountInstructionBuilder = async ({ validatorIndex, ...accountsArgs }: { validatorIndex: number } & Parameters<this['depositStakeAccountInstructionAccounts']>[0]) =>
    this.depositStakeAccountInstruction({
      validatorIndex,
      accounts: await this.depositStakeAccountInstructionAccounts(accountsArgs),
    })
}

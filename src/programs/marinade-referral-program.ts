import { BN, Idl, Program, Provider, web3 } from '@project-serum/anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { SYSVAR_CLOCK_PUBKEY, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { MarinadeState } from '../marinade-state/marinade-state'
import { MarinadeReferralStateResponse } from '../marinade-referral-state/marinade-referral-state.types'
import { Marinade } from '../marinade'
import { STAKE_PROGRAM_ID, SYSTEM_PROGRAM_ID } from '../util'
import { assertNotNullAndReturn } from '../util/assert'
import { MarinadeReferralIdl } from './idl/marinade-referral-idl'
import * as marinadeReferralIdlSchema from './idl/marinade-referral-idl.json'
import {MarinadeFinanceIdl} from "./idl/marinade-finance-idl"

export class MarinadeReferralProgram {
  referralStateData: MarinadeReferralStateResponse.ReferralState | null = null

  constructor(
    public readonly programAddress: web3.PublicKey,
    public readonly anchorProvider: Provider,
    public readonly referralState: web3.PublicKey | null,
    readonly marinade: Marinade,
  ) { }

  get program(): Program {
    return new Program(
      marinadeReferralIdlSchema as Idl,
      this.programAddress,
      this.anchorProvider,
    )
  }

  liquidUnstakeInstructionAccounts = async({ marinadeState, ownerAddress, associatedMSolTokenAccountAddress }: {
    marinadeState: MarinadeState,
    ownerAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeReferralIdl.Instruction.LiquidUnstake.Accounts> => ({
    marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
    state: marinadeState.marinadeStateAddress,
    referralState: assertNotNullAndReturn(this.referralState, 'The referral code must be provided!'),
    msolMint: marinadeState.mSolMintAddress,
    liqPoolMsolLeg: marinadeState.mSolLeg,
    liqPoolSolLegPda: await marinadeState.solLeg(),
    getMsolFrom: associatedMSolTokenAccountAddress,
    getMsolFromAuthority: ownerAddress,
    transferSolTo: ownerAddress,
    treasuryMsolAccount: marinadeState.treasuryMsolAccount,
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    msolTokenPartnerAccount: (await this.getReferralStateData()).msolTokenPartnerAccount,
  })

  liquidUnstakeInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeReferralIdl.Instruction.LiquidUnstake.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.liquidUnstake(
    amountLamports,
    { accounts }
  )

  liquidUnstakeInstructionBuilder = async({ amountLamports, ...accountsArgs }: { amountLamports: BN } & Parameters<this['liquidUnstakeInstructionAccounts']>[0]) =>
    this.liquidUnstakeInstruction({
      amountLamports,
      accounts: await this.liquidUnstakeInstructionAccounts(accountsArgs),
    })

  orderUnstakeInstructionAccounts = async({
    marinadeState,
    ownerAddress,
    associatedMSolTokenAccountAddress,
    newTicketAccount,
  }: {
    marinadeState: MarinadeState,
    ownerAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
    newTicketAccount: web3.PublicKey,
  }): Promise<MarinadeReferralIdl.Instruction.OrderUnstake.Accounts> => ({
    state: marinadeState.marinadeStateAddress,
    msolMint: marinadeState.mSolMintAddress,
    burnMsolFrom: associatedMSolTokenAccountAddress,
    burnMsolAuthority: ownerAddress,
    newTicketAccount,
    tokenProgram: TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    clock: SYSVAR_CLOCK_PUBKEY,
    msolTokenPartnerAccount: (await this.getReferralStateData()).msolTokenPartnerAccount,
  })

  orderUnstakeInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeReferralIdl.Instruction.OrderUnstake.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.orderUnstake(
    amountLamports,
    { accounts }
  )

  orderUnstakeInstructionBuilder = async({ amountLamports, ...accountsArgs }: { amountLamports: BN } & Parameters<this['orderUnstakeInstructionAccounts']>[0]) =>
    this.orderUnstakeInstruction({
      amountLamports,
      accounts: await this.orderUnstakeInstructionAccounts(accountsArgs),
    })

  claimInstructionAccounts = async({
    marinadeState,
    ownerAddress,
    ticketAccount,
  }: {
    marinadeState: MarinadeState,
    ownerAddress: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
    ticketAccount: web3.PublicKey,
  }): Promise<MarinadeFinanceIdl.Instruction.Claim.Accounts> => ({
    state: marinadeState.marinadeStateAddress,
    reservePda: await marinadeState.reserveAddress(),
    ticketAccount,
    transferSolTo: ownerAddress,
    clock: SYSVAR_CLOCK_PUBKEY,
    systemProgram: SYSTEM_PROGRAM_ID,
  })

  claimInstruction = ({ accounts }: {
    accounts: MarinadeFinanceIdl.Instruction.Claim.Accounts,
  }): web3.TransactionInstruction => this.program.instruction.claim(
    { accounts }
  )

  claimInstructionBuilder = async({ ...accountsArgs }: Parameters<this['claimInstructionAccounts']>[0]) =>
    this.claimInstruction({
      accounts: await this.claimInstructionAccounts(accountsArgs),
    })

  depositInstructionAccounts = async({ marinadeState, transferFrom, associatedMSolTokenAccountAddress }: {
    marinadeState: MarinadeState,
    transferFrom: web3.PublicKey,
    associatedMSolTokenAccountAddress: web3.PublicKey,
  }): Promise<MarinadeReferralIdl.Instruction.Deposit.Accounts> => ({
    reservePda: await marinadeState.reserveAddress(),
    marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
    referralState: assertNotNullAndReturn(this.referralState, 'The referral code must be provided!'),
    state: marinadeState.marinadeStateAddress,
    msolMint: marinadeState.mSolMintAddress,
    msolMintAuthority: await marinadeState.mSolMintAuthority(),
    liqPoolMsolLegAuthority: await marinadeState.mSolLegAuthority(),
    liqPoolMsolLeg: marinadeState.mSolLeg,
    liqPoolSolLegPda: await marinadeState.solLeg(),
    mintTo: associatedMSolTokenAccountAddress,
    transferFrom,
    systemProgram: SYSTEM_PROGRAM_ID,
    tokenProgram: TOKEN_PROGRAM_ID,
    msolTokenPartnerAccount: (await this.getReferralStateData()).msolTokenPartnerAccount,
  })

  depositInstruction = ({ accounts, amountLamports }: {
    accounts: MarinadeReferralIdl.Instruction.Deposit.Accounts,
    amountLamports: BN,
  }): web3.TransactionInstruction => this.program.instruction.deposit(
    amountLamports,
    { accounts }
  )

  depositInstructionBuilder = async({ amountLamports, ...accountsArgs }: { amountLamports: BN } & Parameters<this['depositInstructionAccounts']>[0]) =>
    this.depositInstruction({
      amountLamports,
      accounts: await this.depositInstructionAccounts(accountsArgs),
    })

  depositStakeAccountInstructionAccounts = async({
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
    state: marinadeState.marinadeStateAddress,
    marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
    referralState: assertNotNullAndReturn(this.referralState, 'The referral code must be provided!'),
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
    msolTokenPartnerAccount: (await this.getReferralStateData()).msolTokenPartnerAccount,
  })

  depositStakeAccountInstruction = ({ accounts, validatorIndex }: {
    accounts: MarinadeReferralIdl.Instruction.DepositStakeAccount.Accounts,
    validatorIndex: number,
  }): web3.TransactionInstruction => this.program.instruction.depositStakeAccount(
    validatorIndex,
    { accounts },
  )

  depositStakeAccountInstructionBuilder = async({ validatorIndex, ...accountsArgs }: { validatorIndex: number } & Parameters<this['depositStakeAccountInstructionAccounts']>[0]) =>
    this.depositStakeAccountInstruction({
      validatorIndex,
      accounts: await this.depositStakeAccountInstructionAccounts(accountsArgs),
    })

  async getReferralStateData(): Promise<MarinadeReferralStateResponse.ReferralState> {
    if (!this.referralStateData) {
      this.referralStateData = (await this.marinade.getReferralPartnerState()).state
    }
    return this.referralStateData
  }
}

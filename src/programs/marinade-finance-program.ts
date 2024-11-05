import { BN, Program, web3, Provider, IdlTypes } from '@coral-xyz/anchor'
import { MarinadeState } from '../marinade-state/marinade-state'
import {
  STAKE_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  getEpochInfo,
  getTicketDateInfo,
  estimateTicketDateInfo,
} from '../util'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token-3.x'
import { TicketAccount } from '../marinade-state/borsh/ticket-account'
import * as mariandeFinance from './idl/types/marinade_finance'

const MarinadeFinanceIDL = mariandeFinance.IDL
type MarinadeFinance = mariandeFinance.MarinadeFinance
export type MarinadeFinanceProgramType = Program<MarinadeFinance>

export type ValidatorRecordAnchorType =
  IdlTypes<mariandeFinance.MarinadeFinance>['ValidatorRecord']
export type StateRecordAnchorType =
  IdlTypes<mariandeFinance.MarinadeFinance>['StakeRecord']

export class MarinadeFinanceProgram {
  constructor(
    public readonly programAddress: web3.PublicKey,
    public readonly anchorProvider: Provider
  ) {}

  get program(): MarinadeFinanceProgramType {
    return new Program<MarinadeFinance>(
      MarinadeFinanceIDL,
      this.programAddress,
      this.anchorProvider
    )
  }

  async getDelayedUnstakeTickets(
    beneficiary?: web3.PublicKey
  ): Promise<Map<web3.PublicKey, TicketAccount>> {
    const filters: web3.GetProgramAccountsFilter[] = [
      {
        dataSize: 88,
      },
    ]

    if (beneficiary) {
      filters.push({
        memcmp: {
          offset: 8 + 32,
          bytes: beneficiary.toBase58(),
        },
      })
    }

    const ticketAccounts = await this.program.account.ticketAccountData.all(
      filters
    )
    const epochInfo = await getEpochInfo(this.anchorProvider.connection)

    return new Map(
      ticketAccounts.map(ticketAccount => {
        const ticketAccountdata = ticketAccount.account
        const ticketAcconuntPubkey = ticketAccount.publicKey
        const ticketDateInfo = getTicketDateInfo(
          epochInfo,
          ticketAccountdata.createdEpoch.toNumber(),
          Date.now()
        )

        return [
          ticketAcconuntPubkey,
          { ...ticketAccountdata, ...ticketDateInfo },
        ]
      })
    )
  }

  // Estimate due date if a ticket would be created right now
  getEstimatedUnstakeTicketDueDate = async (marinadeState: MarinadeState) => {
    const epochInfo = await getEpochInfo(this.anchorProvider.connection)
    return estimateTicketDateInfo(
      epochInfo,
      Date.now(),
      marinadeState.state.stakeSystem.slotsForStakeDelta.toNumber()
    )
  }

  addLiquidityInstructionBuilder = async ({
    marinadeState,
    ownerAddress,
    associatedLPTokenAccountAddress,
    amountLamports,
  }: {
    marinadeState: MarinadeState
    ownerAddress: web3.PublicKey
    associatedLPTokenAccountAddress: web3.PublicKey
    amountLamports: BN
  }): Promise<web3.TransactionInstruction> =>
    await this.program.methods
      .addLiquidity(amountLamports)
      .accountsStrict({
        state: marinadeState.marinadeStateAddress,
        lpMint: marinadeState.lpMintAddress,
        lpMintAuthority: await marinadeState.lpMintAuthority(),
        liqPoolMsolLeg: marinadeState.mSolLeg,
        liqPoolSolLegPda: await marinadeState.solLeg(),
        transferFrom: ownerAddress,
        mintTo: associatedLPTokenAccountAddress,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction()

  removeLiquidityInstructionBuilder = async ({
    marinadeState,
    ownerAddress,
    associatedLPTokenAccountAddress,
    associatedMSolTokenAccountAddress,
    amountLamports,
  }: {
    marinadeState: MarinadeState
    ownerAddress: web3.PublicKey
    associatedLPTokenAccountAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    amountLamports: BN
  }): Promise<web3.TransactionInstruction> =>
    await this.program.methods
      .removeLiquidity(amountLamports)
      .accountsStrict({
        state: marinadeState.marinadeStateAddress,
        lpMint: marinadeState.lpMintAddress,
        burnFrom: associatedLPTokenAccountAddress,
        burnFromAuthority: ownerAddress,
        liqPoolSolLegPda: await marinadeState.solLeg(),
        transferSolTo: ownerAddress,
        transferMsolTo: associatedMSolTokenAccountAddress,
        liqPoolMsolLeg: marinadeState.mSolLeg,
        liqPoolMsolLegAuthority: await marinadeState.mSolLegAuthority(),
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction()

  liquidUnstakeInstructionBuilder = async ({
    marinadeState,
    ownerAddress,
    associatedMSolTokenAccountAddress,
    amountLamports,
  }: {
    marinadeState: MarinadeState
    ownerAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    amountLamports: BN
  }): Promise<web3.TransactionInstruction> =>
    await this.program.methods
      .liquidUnstake(amountLamports)
      .accountsStrict({
        state: marinadeState.marinadeStateAddress,
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
      .instruction()

  depositInstructionBuilder = async ({
    marinadeState,
    transferFrom,
    associatedMSolTokenAccountAddress,
    amountLamports,
  }: {
    marinadeState: MarinadeState
    transferFrom: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    amountLamports: BN
  }): Promise<web3.TransactionInstruction> =>
    await this.program.methods
      .deposit(amountLamports)
      .accountsStrict({
        reservePda: await marinadeState.reserveAddress(),
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
      })
      .instruction()

  depositStakeAccountInstructionBuilder = async ({
    marinadeState,
    duplicationFlag,
    ownerAddress,
    stakeAccountAddress,
    authorizedWithdrawerAddress,
    associatedMSolTokenAccountAddress,
    validatorIndex,
  }: {
    marinadeState: MarinadeState
    duplicationFlag: web3.PublicKey
    ownerAddress: web3.PublicKey
    stakeAccountAddress: web3.PublicKey
    authorizedWithdrawerAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    validatorIndex: number
  }): Promise<web3.TransactionInstruction> =>
    this.program.methods
      .depositStakeAccount(validatorIndex)
      .accountsStrict({
        duplicationFlag,
        stakeAuthority: authorizedWithdrawerAddress,
        state: marinadeState.marinadeStateAddress,
        stakeList: marinadeState.state.stakeSystem.stakeList.account,
        stakeAccount: stakeAccountAddress,
        validatorList:
          marinadeState.state.validatorSystem.validatorList.account,
        msolMint: marinadeState.mSolMintAddress,
        msolMintAuthority: await marinadeState.mSolMintAuthority(),
        mintTo: associatedMSolTokenAccountAddress,
        rentPayer: ownerAddress,
        clock: web3.SYSVAR_CLOCK_PUBKEY,
        rent: web3.SYSVAR_RENT_PUBKEY,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        stakeProgram: STAKE_PROGRAM_ID,
      })
      .instruction()

  claimInstructionBuilder = async ({
    marinadeState,
    ticketAccount,
    transferSolTo,
  }: {
    marinadeState: MarinadeState
    ticketAccount: web3.PublicKey
    transferSolTo: web3.PublicKey
  }): Promise<web3.TransactionInstruction> =>
    await this.program.methods
      .claim()
      .accountsStrict({
        state: marinadeState.marinadeStateAddress,
        reservePda: await marinadeState.reserveAddress(),
        ticketAccount,
        transferSolTo,
        clock: web3.SYSVAR_CLOCK_PUBKEY,
        systemProgram: SYSTEM_PROGRAM_ID,
      })
      .instruction()

  orderUnstakeInstructionBuilder = async ({
    marinadeState,
    ownerAddress,
    associatedMSolTokenAccountAddress,
    newTicketAccount,
    msolAmount,
  }: {
    marinadeState: MarinadeState
    ownerAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    newTicketAccount: web3.PublicKey
    msolAmount: BN
  }): Promise<web3.TransactionInstruction> =>
    await this.program.methods
      .orderUnstake(msolAmount)
      .accountsStrict({
        state: marinadeState.marinadeStateAddress,
        msolMint: marinadeState.mSolMintAddress,
        burnMsolFrom: associatedMSolTokenAccountAddress,
        burnMsolAuthority: ownerAddress,
        newTicketAccount,
        rent: web3.SYSVAR_RENT_PUBKEY,
        clock: web3.SYSVAR_CLOCK_PUBKEY,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction()

  withdrawStakeAccount = async ({
    marinadeState,
    ownerAddress,
    associatedMSolTokenAccountAddress, // burnMsolFrom
    stakeAccountAddress,
    splitStakeAccountAddress,
    splitStakeRentPayer,
    stakeIndex,
    validatorIndex,
    msolAmount,
    beneficiary,
  }: {
    marinadeState: MarinadeState
    ownerAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    stakeAccountAddress: web3.PublicKey
    splitStakeAccountAddress: web3.PublicKey
    splitStakeRentPayer: web3.PublicKey
    stakeIndex: number
    validatorIndex: number
    msolAmount: BN
    beneficiary: web3.PublicKey
  }): Promise<web3.TransactionInstruction> =>
    await this.program.methods
      .withdrawStakeAccount(stakeIndex, validatorIndex, msolAmount, beneficiary)
      .accountsStrict({
        state: marinadeState.marinadeStateAddress,
        msolMint: marinadeState.mSolMintAddress,
        burnMsolFrom: associatedMSolTokenAccountAddress,
        burnMsolAuthority: ownerAddress,
        treasuryMsolAccount: marinadeState.treasuryMsolAccount,
        validatorList:
          marinadeState.state.validatorSystem.validatorList.account,
        stakeList: marinadeState.state.stakeSystem.stakeList.account,
        stakeWithdrawAuthority: await marinadeState.stakeWithdrawAuthority(),
        stakeDepositAuthority: await marinadeState.stakeDepositAuthority(),
        stakeAccount: stakeAccountAddress,
        splitStakeAccount: splitStakeAccountAddress,
        splitStakeRentPayer,
        clock: web3.SYSVAR_CLOCK_PUBKEY,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        stakeProgram: STAKE_PROGRAM_ID,
      })
      .instruction()
}

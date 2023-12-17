import { AnchorProvider, Program, IdlTypes } from '@coral-xyz/anchor'
import {
  getEpochInfo,
  getTicketDateInfo,
  estimateTicketDateInfo,
} from '../util'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { TicketAccount } from '../marinade-state/borsh/ticket-account'
import * as marinadeFinance from './idl/types/marinade_finance'
import { MarinadeState } from '../marinade-state/marinade-state.types'
import { TicketDateInfo } from '../util/ticket-date-info.types'
import {
  lpMintAuthority,
  mSolLegAuthority,
  mSolMintAuthority,
  reserveAddress,
  solLeg,
} from '../marinade-state/marinade-state'
import { DEFAULT_MARINADE_PROGRAM_ID } from '../config/marinade-config'
import {
  ConfirmOptions,
  Connection,
  GetProgramAccountsFilter,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  StakeProgram,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js'
import BN from 'bn.js'

const MarinadeFinanceIDL = marinadeFinance.IDL
type MarinadeFinance = marinadeFinance.MarinadeFinance
export type MarinadeFinanceProgram = Program<MarinadeFinance>

export type ValidatorRecordAnchorType =
  IdlTypes<marinadeFinance.MarinadeFinance>['ValidatorRecord']
export type StateRecordAnchorType =
  IdlTypes<marinadeFinance.MarinadeFinance>['StakeRecord']

export function marinadeFinanceProgram({
  programAddress = DEFAULT_MARINADE_PROGRAM_ID,
  cnx,
  walletAddress,
  opts = {},
}: {
  programAddress?: PublicKey
  cnx: Connection
  walletAddress: PublicKey
  opts?: ConfirmOptions
}): MarinadeFinanceProgram {
  const provider = new AnchorProvider(
    cnx,
    {
      signTransaction: () => {
        throw new Error()
      },
      signAllTransactions: () => {
        throw new Error()
      },
      publicKey: walletAddress,
    },
    opts ?? AnchorProvider.defaultOptions()
  )
  const program = new Program<MarinadeFinance>(
    MarinadeFinanceIDL,
    programAddress,
    provider
  )
  return program
}

/**
 * Retrieve user's ticket accounts
 *
 * @param {PublicKey} beneficiary - The owner of the ticket accounts
 */
export async function getDelayedUnstakeTickets(
  program: MarinadeFinanceProgram,
  beneficiary?: PublicKey
): Promise<Map<PublicKey, TicketAccount>> {
  const filters: GetProgramAccountsFilter[] = [
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

  const ticketAccounts = await program.account.ticketAccountData.all(filters)
  const epochInfo = await getEpochInfo(program.provider.connection)

  return new Map(
    ticketAccounts.map(ticketAccount => {
      const ticketAccountData = ticketAccount.account
      const ticketAccountPubkey = ticketAccount.publicKey
      const ticketDateInfo = getTicketDateInfo(
        epochInfo,
        ticketAccountData.createdEpoch.toNumber(),
        Date.now()
      )

      return [ticketAccountPubkey, { ...ticketAccountData, ...ticketDateInfo }]
    })
  )
}

/**
 * Estimate due date if a ticket would be created right now
 */
export async function getEstimatedUnstakeTicketDueDate(
  connection: Connection,
  marinadeState: Readonly<MarinadeState>
): Promise<TicketDateInfo> {
  const epochInfo = await getEpochInfo(connection)
  return estimateTicketDateInfo(
    epochInfo,
    Date.now(),
    marinadeState.stakeSystem.slotsForStakeDelta.toNumber()
  )
}

export async function addLiquidityInstructionBuilder({
  program,
  marinadeState,
  ownerAddress,
  associatedLPTokenAccountAddress,
  amountLamports,
}: {
  program: MarinadeFinanceProgram
  marinadeState: Readonly<MarinadeState>
  ownerAddress: PublicKey
  associatedLPTokenAccountAddress: PublicKey
  amountLamports: BN
}): Promise<TransactionInstruction> {
  return await program.methods
    .addLiquidity(amountLamports)
    .accountsStrict({
      state: marinadeState.address,
      lpMint: marinadeState.liqPool.lpMint,
      lpMintAuthority: lpMintAuthority(marinadeState),
      liqPoolMsolLeg: marinadeState.liqPool.msolLeg,
      liqPoolSolLegPda: solLeg(marinadeState),
      transferFrom: ownerAddress,
      mintTo: associatedLPTokenAccountAddress,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()
}

export async function removeLiquidityInstructionBuilder({
  program,
  marinadeState,
  ownerAddress,
  associatedLPTokenAccountAddress,
  associatedMSolTokenAccountAddress,
  amountLamports,
}: {
  program: MarinadeFinanceProgram
  marinadeState: Readonly<MarinadeState>
  ownerAddress: PublicKey
  associatedLPTokenAccountAddress: PublicKey
  associatedMSolTokenAccountAddress: PublicKey
  amountLamports: BN
}): Promise<TransactionInstruction> {
  return await program.methods
    .removeLiquidity(amountLamports)
    .accountsStrict({
      state: marinadeState.address,
      lpMint: marinadeState.liqPool.lpMint,
      burnFrom: associatedLPTokenAccountAddress,
      burnFromAuthority: ownerAddress,
      liqPoolSolLegPda: solLeg(marinadeState),
      transferSolTo: ownerAddress,
      transferMsolTo: associatedMSolTokenAccountAddress,
      liqPoolMsolLeg: marinadeState.liqPool.msolLeg,
      liqPoolMsolLegAuthority: mSolLegAuthority(marinadeState),
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()
}

export async function liquidUnstakeInstructionBuilder({
  program,
  marinadeState,
  ownerAddress,
  associatedMSolTokenAccountAddress,
  amountLamports,
}: {
  program: MarinadeFinanceProgram
  marinadeState: Readonly<MarinadeState>
  ownerAddress: PublicKey
  associatedMSolTokenAccountAddress: PublicKey
  amountLamports: BN
}): Promise<TransactionInstruction> {
  return await program.methods
    .liquidUnstake(amountLamports)
    .accountsStrict({
      state: marinadeState.address,
      msolMint: marinadeState.msolMint,
      liqPoolMsolLeg: marinadeState.liqPool.msolLeg,
      liqPoolSolLegPda: solLeg(marinadeState),
      getMsolFrom: associatedMSolTokenAccountAddress,
      getMsolFromAuthority: ownerAddress,
      transferSolTo: ownerAddress,
      treasuryMsolAccount: marinadeState.treasuryMsolAccount,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()
}

export async function depositInstructionBuilder({
  program,
  marinadeState,
  transferFrom,
  associatedMSolTokenAccountAddress,
  amountLamports,
}: {
  program: MarinadeFinanceProgram
  marinadeState: Readonly<MarinadeState>
  transferFrom: PublicKey
  associatedMSolTokenAccountAddress: PublicKey
  amountLamports: BN
}): Promise<TransactionInstruction> {
  return await program.methods
    .deposit(amountLamports)
    .accountsStrict({
      state: marinadeState.address,
      reservePda: reserveAddress(marinadeState),
      msolMint: marinadeState.msolMint,
      msolMintAuthority: mSolMintAuthority(marinadeState),
      liqPoolMsolLegAuthority: mSolLegAuthority(marinadeState),
      liqPoolMsolLeg: marinadeState.liqPool.msolLeg,
      liqPoolSolLegPda: solLeg(marinadeState),
      mintTo: associatedMSolTokenAccountAddress,
      transferFrom,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()
}

export async function depositStakeAccountInstructionBuilder({
  program,
  marinadeState,
  duplicationFlag,
  ownerAddress,
  stakeAccountAddress,
  authorizedWithdrawerAddress,
  associatedMSolTokenAccountAddress,
  validatorIndex,
}: {
  program: MarinadeFinanceProgram
  marinadeState: Readonly<MarinadeState>
  duplicationFlag: PublicKey
  ownerAddress: PublicKey
  stakeAccountAddress: PublicKey
  authorizedWithdrawerAddress: PublicKey
  associatedMSolTokenAccountAddress: PublicKey
  validatorIndex: number
}): Promise<TransactionInstruction> {
  return program.methods
    .depositStakeAccount(validatorIndex)
    .accountsStrict({
      state: marinadeState.address,
      duplicationFlag,
      stakeAuthority: authorizedWithdrawerAddress,
      stakeList: marinadeState.stakeSystem.stakeList.account,
      stakeAccount: stakeAccountAddress,
      validatorList: marinadeState.validatorSystem.validatorList.account,
      msolMint: marinadeState.msolMint,
      msolMintAuthority: mSolMintAuthority(marinadeState),
      mintTo: associatedMSolTokenAccountAddress,
      rentPayer: ownerAddress,
      clock: SYSVAR_CLOCK_PUBKEY,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      stakeProgram: StakeProgram.programId,
    })
    .instruction()
}

export async function claimInstructionBuilder({
  program,
  marinadeState,
  ticketAccount,
  transferSolTo,
}: {
  program: MarinadeFinanceProgram
  marinadeState: Readonly<MarinadeState>
  ticketAccount: PublicKey
  transferSolTo: PublicKey
}): Promise<TransactionInstruction> {
  return await program.methods
    .claim()
    .accountsStrict({
      state: marinadeState.address,
      reservePda: reserveAddress(marinadeState),
      ticketAccount,
      transferSolTo,
      clock: SYSVAR_CLOCK_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .instruction()
}

export async function orderUnstakeInstructionBuilder({
  program,
  marinadeState,
  ownerAddress,
  associatedMSolTokenAccountAddress,
  newTicketAccount,
  msolAmount,
}: {
  program: MarinadeFinanceProgram
  marinadeState: Readonly<MarinadeState>
  ownerAddress: PublicKey
  associatedMSolTokenAccountAddress: PublicKey
  newTicketAccount: PublicKey
  msolAmount: BN
}): Promise<TransactionInstruction> {
  return await program.methods
    .orderUnstake(msolAmount)
    .accountsStrict({
      state: marinadeState.address,
      msolMint: marinadeState.msolMint,
      burnMsolFrom: associatedMSolTokenAccountAddress,
      burnMsolAuthority: ownerAddress,
      newTicketAccount,
      rent: SYSVAR_RENT_PUBKEY,
      clock: SYSVAR_CLOCK_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()
}

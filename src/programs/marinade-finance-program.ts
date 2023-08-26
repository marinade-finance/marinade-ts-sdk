import {
  BN,
  Program,
  web3,
  Provider,
  IdlTypes,
  Wallet,
} from '@coral-xyz/anchor'
import {
  AnchorProvider,
  Wallet as WalletInterface,
} from '@coral-xyz/anchor/dist/cjs/provider'
import {
  STAKE_PROGRAM_ID,
  SYSTEM_PROGRAM_ID,
  getEpochInfo,
  getTicketDateInfo,
  estimateTicketDateInfo,
} from '../util'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token-3.x'
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
import { MarinadeProgramBuilders } from './marinade-program-builders'

const MarinadeFinanceIDL = marinadeFinance.IDL
type MarinadeFinance = marinadeFinance.MarinadeFinance
export type MarinadeFinanceProgram = Program<MarinadeFinance>

export type ValidatorRecordAnchorType =
  IdlTypes<marinadeFinance.MarinadeFinance>['ValidatorRecord']
export type StateRecordAnchorType =
  IdlTypes<marinadeFinance.MarinadeFinance>['StakeRecord']

export function marinadeFinanceProgram({
  programAddress = DEFAULT_MARINADE_PROGRAM_ID,
  provider,
  wallet,
  opts = {},
}: {
  programAddress?: web3.PublicKey
  provider: web3.Connection | Provider
  wallet?: WalletInterface | web3.Keypair
  opts?: web3.ConfirmOptions
}): MarinadeFinanceProgram {
  if (provider instanceof web3.Connection) {
    if (!wallet) {
      throw new Error(
        'Wallet must be provided to initialize the Anchor Program with web3.Connection'
      )
    }
    if (wallet instanceof web3.Keypair) {
      wallet = new Wallet(wallet)
    }
    provider = new AnchorProvider(provider, wallet, opts)
  }
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
 * @param {web3.PublicKey} beneficiary - The owner of the ticket accounts
 */
export async function getDelayedUnstakeTickets(
  program: MarinadeFinanceProgram,
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
  connection: web3.Connection,
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
  ownerAddress: web3.PublicKey
  associatedLPTokenAccountAddress: web3.PublicKey
  amountLamports: BN
}): Promise<web3.TransactionInstruction> {
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
      systemProgram: SYSTEM_PROGRAM_ID,
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
  ownerAddress: web3.PublicKey
  associatedLPTokenAccountAddress: web3.PublicKey
  associatedMSolTokenAccountAddress: web3.PublicKey
  amountLamports: BN
}): Promise<web3.TransactionInstruction> {
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
      systemProgram: SYSTEM_PROGRAM_ID,
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
  ownerAddress: web3.PublicKey
  associatedMSolTokenAccountAddress: web3.PublicKey
  amountLamports: BN
}): Promise<web3.TransactionInstruction> {
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
      systemProgram: SYSTEM_PROGRAM_ID,
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
  transferFrom: web3.PublicKey
  associatedMSolTokenAccountAddress: web3.PublicKey
  amountLamports: BN
}): Promise<web3.TransactionInstruction> {
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
      systemProgram: SYSTEM_PROGRAM_ID,
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
  duplicationFlag: web3.PublicKey
  ownerAddress: web3.PublicKey
  stakeAccountAddress: web3.PublicKey
  authorizedWithdrawerAddress: web3.PublicKey
  associatedMSolTokenAccountAddress: web3.PublicKey
  validatorIndex: number
}): Promise<web3.TransactionInstruction> {
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
      clock: web3.SYSVAR_CLOCK_PUBKEY,
      rent: web3.SYSVAR_RENT_PUBKEY,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      stakeProgram: STAKE_PROGRAM_ID,
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
  ticketAccount: web3.PublicKey
  transferSolTo: web3.PublicKey
}): Promise<web3.TransactionInstruction> {
  return await program.methods
    .claim()
    .accountsStrict({
      state: marinadeState.address,
      reservePda: reserveAddress(marinadeState),
      ticketAccount,
      transferSolTo,
      clock: web3.SYSVAR_CLOCK_PUBKEY,
      systemProgram: SYSTEM_PROGRAM_ID,
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
  ownerAddress: web3.PublicKey
  associatedMSolTokenAccountAddress: web3.PublicKey
  newTicketAccount: web3.PublicKey
  msolAmount: BN
}): Promise<web3.TransactionInstruction> {
  return await program.methods
    .orderUnstake(msolAmount)
    .accountsStrict({
      state: marinadeState.address,
      msolMint: marinadeState.msolMint,
      burnMsolFrom: associatedMSolTokenAccountAddress,
      burnMsolAuthority: ownerAddress,
      newTicketAccount,
      rent: web3.SYSVAR_RENT_PUBKEY,
      clock: web3.SYSVAR_CLOCK_PUBKEY,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction()
}

export class MarinadeFinanceProgramBuilders implements MarinadeProgramBuilders {
  readonly program: MarinadeFinanceProgram

  constructor(program: MarinadeFinanceProgram) {
    this.program = program
  }

  static init({
    programAddress,
    provider,
    wallet,
    opts = {},
  }: {
    programAddress?: web3.PublicKey
    provider: web3.Connection | Provider
    wallet?: WalletInterface | web3.Keypair
    opts?: web3.ConfirmOptions
  }): MarinadeFinanceProgramBuilders {
    const program = marinadeFinanceProgram({
      programAddress,
      provider,
      wallet,
      opts,
    })
    return new MarinadeFinanceProgramBuilders(program)
  }

  async liquidUnstakeInstructionBuilder({
    marinadeState,
    ownerAddress,
    associatedMSolTokenAccountAddress,
    amountLamports,
  }: {
    marinadeState: MarinadeState
    ownerAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    amountLamports: BN
  }): Promise<web3.TransactionInstruction> {
    return await liquidUnstakeInstructionBuilder({
      program: this.program,
      marinadeState,
      ownerAddress,
      associatedMSolTokenAccountAddress,
      amountLamports,
    })
  }

  async depositInstructionBuilder({
    marinadeState,
    transferFrom,
    associatedMSolTokenAccountAddress,
    amountLamports,
  }: {
    marinadeState: MarinadeState
    transferFrom: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    amountLamports: BN
  }): Promise<web3.TransactionInstruction> {
    return await depositInstructionBuilder({
      program: this.program,
      marinadeState,
      transferFrom,
      associatedMSolTokenAccountAddress,
      amountLamports,
    })
  }

  async depositStakeAccountInstructionBuilder({
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
  }): Promise<web3.TransactionInstruction> {
    return await depositStakeAccountInstructionBuilder({
      program: this.program,
      marinadeState,
      duplicationFlag,
      ownerAddress,
      stakeAccountAddress,
      authorizedWithdrawerAddress,
      associatedMSolTokenAccountAddress,
      validatorIndex,
    })
  }
}

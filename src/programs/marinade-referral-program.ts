import { BN, Program, Provider, web3, Wallet } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token-3.x'
import { MarinadeReferralState } from '../marinade-referral-state/marinade-referral-state.types'
import { STAKE_PROGRAM_ID, SYSTEM_PROGRAM_ID } from '../util'
import * as marinadeReferral from './idl/types/marinade_referral'
import { DEFAULT_MARINADE_REFERRAL_PROGRAM_ID } from '../config/marinade-config'
import {
  AnchorProvider,
  Wallet as WalletInterface,
} from '@coral-xyz/anchor/dist/cjs/provider'
import { MarinadeState } from '../marinade-state/marinade-state.types'
import {
  mSolLegAuthority,
  mSolMintAuthority,
  reserveAddress,
  solLeg,
} from '../marinade-state/marinade-state'
import { fetchReferralState } from '../marinade-referral-state/marinade-referral-partner-state'
import { MarinadeProgramBuilders } from './marinade-program-builders'

const MarinadeReferralIDL = marinadeReferral.IDL
type MarinadeReferral = marinadeReferral.MarinadeReferral
export type MarinadeReferralProgram = Program<MarinadeReferral>

export function marinadeReferralProgram({
  programAddress = DEFAULT_MARINADE_REFERRAL_PROGRAM_ID,
  provider,
  wallet,
  opts = {},
}: {
  programAddress?: web3.PublicKey
  provider: web3.Connection | Provider
  wallet?: WalletInterface | web3.Keypair
  opts?: web3.ConfirmOptions
}): MarinadeReferralProgram {
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
  return new Program<MarinadeReferral>(
    MarinadeReferralIDL,
    programAddress,
    provider
  )
}

export async function liquidUnstakeInstructionBuilder({
  program,
  marinadeState,
  referralState,
  ownerAddress,
  associatedMSolTokenAccountAddress,
  amountLamports,
}: {
  program: MarinadeReferralProgram
  marinadeState: MarinadeState
  referralState: MarinadeReferralState
  ownerAddress: web3.PublicKey
  associatedMSolTokenAccountAddress: web3.PublicKey
  amountLamports: BN
}): Promise<web3.TransactionInstruction> {
  return await program.methods
    .liquidUnstake(amountLamports)
    .accountsStrict({
      marinadeFinanceProgram: marinadeState.programId,
      state: marinadeState.address,
      referralState: referralState.address,
      msolMint: marinadeState.msolMint,
      liqPoolMsolLeg: marinadeState.liqPool.msolLeg,
      liqPoolSolLegPda: solLeg(marinadeState),
      getMsolFrom: associatedMSolTokenAccountAddress,
      getMsolFromAuthority: ownerAddress,
      transferSolTo: ownerAddress,
      treasuryMsolAccount: marinadeState.treasuryMsolAccount,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      msolTokenPartnerAccount: referralState.msolTokenPartnerAccount,
    })
    .instruction()
}

export async function depositInstructionBuilder({
  program,
  marinadeState,
  referralState,
  transferFrom,
  associatedMSolTokenAccountAddress,
  amountLamports,
}: {
  program: MarinadeReferralProgram
  marinadeState: MarinadeState
  referralState: MarinadeReferralState
  transferFrom: web3.PublicKey
  associatedMSolTokenAccountAddress: web3.PublicKey
  amountLamports: BN
}): Promise<web3.TransactionInstruction> {
  return await program.methods
    .deposit(amountLamports)
    .accountsStrict({
      reservePda: reserveAddress(marinadeState),
      marinadeFinanceProgram: marinadeState.programId,
      referralState: referralState.address,
      state: marinadeState.address,
      msolMint: marinadeState.msolMint,
      msolMintAuthority: mSolMintAuthority(marinadeState),
      liqPoolMsolLegAuthority: mSolLegAuthority(marinadeState),
      liqPoolMsolLeg: marinadeState.liqPool.msolLeg,
      liqPoolSolLegPda: solLeg(marinadeState),
      mintTo: associatedMSolTokenAccountAddress,
      transferFrom,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      msolTokenPartnerAccount: referralState.msolTokenPartnerAccount,
    })
    .instruction()
}

export async function depositStakeAccountInstructionBuilder({
  program,
  marinadeState,
  referralState,
  duplicationFlag,
  ownerAddress,
  stakeAccountAddress,
  authorizedWithdrawerAddress,
  associatedMSolTokenAccountAddress,
  validatorIndex,
}: {
  program: MarinadeReferralProgram
  marinadeState: MarinadeState
  referralState: MarinadeReferralState
  duplicationFlag: web3.PublicKey
  ownerAddress: web3.PublicKey
  stakeAccountAddress: web3.PublicKey
  authorizedWithdrawerAddress: web3.PublicKey
  associatedMSolTokenAccountAddress: web3.PublicKey
  validatorIndex: number
}): Promise<web3.TransactionInstruction> {
  return await program.methods
    .depositStakeAccount(validatorIndex)
    .accountsStrict({
      duplicationFlag,
      stakeAuthority: authorizedWithdrawerAddress,
      state: marinadeState.address,
      marinadeFinanceProgram: marinadeState.programId,
      referralState: referralState.address,
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
      msolTokenPartnerAccount: referralState.msolTokenPartnerAccount,
    })
    .instruction()
}

export function isMarinadeReferralProgramBuilders(
  programBuilders: MarinadeProgramBuilders
): programBuilders is MarinadeReferralProgramBuilders {
  return (
    (programBuilders as MarinadeReferralProgramBuilders).referralState !==
    undefined
  )
}

export class MarinadeReferralProgramBuilders
  implements MarinadeProgramBuilders
{
  readonly program: MarinadeReferralProgram
  readonly referralState: MarinadeReferralState

  constructor(
    program: MarinadeReferralProgram,
    referralState: MarinadeReferralState
  ) {
    this.program = program
    this.referralState = referralState
  }

  static async init({
    programAddress,
    referralStateAddress,
    provider,
    wallet,
    opts = {},
  }: {
    programAddress?: web3.PublicKey
    referralStateAddress: web3.PublicKey
    provider: web3.Connection | Provider
    wallet?: WalletInterface | web3.Keypair
    opts?: web3.ConfirmOptions
  }): Promise<MarinadeReferralProgramBuilders> {
    const program = marinadeReferralProgram({
      programAddress,
      provider,
      wallet,
      opts,
    })
    const referralState = await fetchReferralState(
      program,
      referralStateAddress
    )
    return new MarinadeReferralProgramBuilders(program, referralState)
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
      referralState: this.referralState,
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
      referralState: this.referralState,
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
      referralState: this.referralState,
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

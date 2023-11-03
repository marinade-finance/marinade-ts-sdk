import { Program, Provider, Wallet } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { MarinadeReferralReferralState } from '../marinade-referral-state/marinade-referral-state.types'
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
import {
  ConfirmOptions,
  Connection,
  Keypair,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js'
import BN from 'bn.js'

const MarinadeReferralIDL = marinadeReferral.IDL
type MarinadeReferral = marinadeReferral.MarinadeReferral
export type MarinadeReferralProgram = Program<MarinadeReferral>

export function marinadeReferralProgram({
  programAddress = DEFAULT_MARINADE_REFERRAL_PROGRAM_ID,
  provider,
  wallet,
  opts = {},
}: {
  programAddress?: PublicKey
  provider: Connection | Provider
  wallet?: WalletInterface | Keypair
  opts?: ConfirmOptions
}): MarinadeReferralProgram {
  if (provider instanceof Connection) {
    if (!wallet) {
      throw new Error(
        'Wallet must be provided to initialize the Anchor Program with Connection'
      )
    }
    if (wallet instanceof Keypair) {
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
  referralState: MarinadeReferralReferralState
  ownerAddress: PublicKey
  associatedMSolTokenAccountAddress: PublicKey
  amountLamports: BN
}): Promise<TransactionInstruction> {
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
  referralState: MarinadeReferralReferralState
  transferFrom: PublicKey
  associatedMSolTokenAccountAddress: PublicKey
  amountLamports: BN
}): Promise<TransactionInstruction> {
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
  referralState: MarinadeReferralReferralState
  duplicationFlag: PublicKey
  ownerAddress: PublicKey
  stakeAccountAddress: PublicKey
  authorizedWithdrawerAddress: PublicKey
  associatedMSolTokenAccountAddress: PublicKey
  validatorIndex: number
}): Promise<TransactionInstruction> {
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
      clock: SYSVAR_CLOCK_PUBKEY,
      rent: SYSVAR_RENT_PUBKEY,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      stakeProgram: STAKE_PROGRAM_ID,
      msolTokenPartnerAccount: referralState.msolTokenPartnerAccount,
    })
    .instruction()
}

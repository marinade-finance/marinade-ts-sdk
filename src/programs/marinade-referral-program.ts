import { BN, Program, Provider, web3 } from '@coral-xyz/anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token-3.x'
import { MarinadeState } from '../marinade-state/marinade-state'
import { MarinadeReferralStateResponse } from '../marinade-referral-state/marinade-referral-state.types'
import { Marinade } from '../marinade'
import { STAKE_PROGRAM_ID, SYSTEM_PROGRAM_ID } from '../util'
import { assertNotNullAndReturn } from '../util/assert'
import * as mariandeReferral from './idl/types/marinade_referral'

const MarinadeReferralIDL = mariandeReferral.IDL
type MarinadeReferral = mariandeReferral.MarinadeReferral
export type MarinadeReferralProgramType = Program<MarinadeReferral>

export class MarinadeReferralProgram {
  referralStateData: MarinadeReferralStateResponse.ReferralState | null = null

  constructor(
    public readonly programAddress: web3.PublicKey,
    public readonly anchorProvider: Provider,
    public readonly referralState: web3.PublicKey | null,
    readonly marinade: Marinade
  ) {}

  get program(): MarinadeReferralProgramType {
    return new Program<MarinadeReferral>(
      MarinadeReferralIDL,
      this.programAddress,
      this.anchorProvider
    )
  }

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
        marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
        state: marinadeState.marinadeStateAddress,
        referralState: assertNotNullAndReturn(
          this.referralState,
          'The referral code must be provided!'
        ),
        msolMint: marinadeState.mSolMintAddress,
        liqPoolMsolLeg: marinadeState.mSolLeg,
        liqPoolSolLegPda: await marinadeState.solLeg(),
        getMsolFrom: associatedMSolTokenAccountAddress,
        getMsolFromAuthority: ownerAddress,
        transferSolTo: ownerAddress,
        treasuryMsolAccount: marinadeState.treasuryMsolAccount,
        systemProgram: SYSTEM_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        msolTokenPartnerAccount: (
          await this.getReferralStateData()
        ).msolTokenPartnerAccount,
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
        marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
        referralState: assertNotNullAndReturn(
          this.referralState,
          'The referral code must be provided!'
        ),
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
        msolTokenPartnerAccount: (
          await this.getReferralStateData()
        ).msolTokenPartnerAccount,
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
    await this.program.methods
      .depositStakeAccount(validatorIndex)
      .accountsStrict({
        duplicationFlag,
        stakeAuthority: authorizedWithdrawerAddress,
        state: marinadeState.marinadeStateAddress,
        marinadeFinanceProgram: marinadeState.marinadeFinanceProgramId,
        referralState: assertNotNullAndReturn(
          this.referralState,
          'The referral code must be provided!'
        ),
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
        msolTokenPartnerAccount: (
          await this.getReferralStateData()
        ).msolTokenPartnerAccount,
      })
      .instruction()

  async getReferralStateData(): Promise<MarinadeReferralStateResponse.ReferralState> {
    if (!this.referralStateData) {
      this.referralStateData = (
        await this.marinade.getReferralPartnerState()
      ).state
    }
    return this.referralStateData
  }
}

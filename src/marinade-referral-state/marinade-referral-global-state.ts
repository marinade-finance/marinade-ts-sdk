import { web3 } from '@coral-xyz/anchor'
import { Marinade } from '../marinade'
import { MarinadeReferralStateResponse } from './marinade-referral-state.types'

export class MarinadeReferralGlobalState {
  private constructor(
    public readonly state: MarinadeReferralStateResponse.GlobalState,
    public readonly marinadeReferralProgramId: web3.PublicKey,
  ) { }

  static async fetch(marinade: Marinade) {
    const { marinadeReferralProgram, config } = marinade

    const globalState = await marinadeReferralProgram.program.account.globalState.fetch(config.marinadeReferralGlobalStateAddress) as unknown as MarinadeReferralStateResponse.GlobalState

    return new MarinadeReferralGlobalState(globalState, config.marinadeReferralProgramId)
  }
}

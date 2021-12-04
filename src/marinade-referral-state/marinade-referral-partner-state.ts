import { web3 } from '@project-serum/anchor'
import { Marinade } from '../marinade'
import { MarinadeReferralStateResponse } from './marinade-referral-state.types'

export class MarinadeReferralPartnerState {
  private constructor(
    public readonly state: MarinadeReferralStateResponse.ReferralState,
    public readonly referralStateAddress: web3.PublicKey,
    public readonly marinadeReferralProgramId: web3.PublicKey,
  ) { }

  static async fetch(marinade: Marinade) {
    const { marinadeReferralProgram, config } = marinade

    if (!config.referralCode) {
      throw new Error('The Referral Code must be provided in the MarinadeConfig!')
    }
    const state = await marinadeReferralProgram.program.account.referralState.fetch(config.referralCode) as MarinadeReferralStateResponse.ReferralState

    return new MarinadeReferralPartnerState(state, config.referralCode, config.marinadeReferralProgramId)
  }

  get partnerName(): string {
    return Buffer.from(this.state.partnerName).toString('ascii')
  }
}

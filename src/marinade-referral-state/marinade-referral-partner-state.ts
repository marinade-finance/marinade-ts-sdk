import { web3 } from "@project-serum/anchor"
import { Marinade } from "../marinade"
import { MarinadeReferralStateResponse } from "./marinade-referral-state.types"

export class MarinadeReferralPartnerState {
  private constructor(
    public readonly state: MarinadeReferralStateResponse.ReferralState,
    public readonly referralStateAddress: web3.PublicKey,
    public readonly marinadeReferralProgramId: web3.PublicKey
  ) {}

  static async fetch(marinade: Marinade, referralCode?: web3.PublicKey) {
    const { marinadeReferralProgram, config } = marinade
    const code = referralCode ?? config.referralCode
    if (!code) {
      throw new Error(
        "The Referral Code must be provided in the MarinadeConfig or supplied as an arg!"
      )
    }
    const state =
      (await marinadeReferralProgram.program.account.referralState.fetch(
        code
      )) as MarinadeReferralStateResponse.ReferralState

    return new MarinadeReferralPartnerState(
      state,
      code,
      config.marinadeReferralProgramId
    )
  }
}

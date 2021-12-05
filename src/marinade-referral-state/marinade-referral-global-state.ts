import { web3 } from '@project-serum/anchor'
import { Marinade } from '../marinade'
import { MarinadeReferralStateResponse, ProgramDerivedAddressSeed } from './marinade-referral-state.types'

export class MarinadeReferralGlobalState {
  private constructor(
    public readonly state: MarinadeReferralStateResponse.GlobalState,
    public readonly marinadeReferralProgramId: web3.PublicKey,
  ) { }

  static async fetch(marinade: Marinade) {
    const { marinadeReferralProgram, config } = marinade

    const globalStatePDA = await this.findGlobalStatePDA(config.marinadeReferralProgramId)
    const globalState = await marinadeReferralProgram.program.account.globalState.fetch(globalStatePDA) as MarinadeReferralStateResponse.GlobalState

    return new MarinadeReferralGlobalState(globalState, config.marinadeReferralProgramId)
  }

  static async findGlobalStatePDA(marinadeReferralProgramId: web3.PublicKey): Promise<web3.PublicKey> {
    const seeds = [Buffer.from(ProgramDerivedAddressSeed.GLOBAL_STATE_SEED)]
    const [result] = await web3.PublicKey.findProgramAddress(seeds, marinadeReferralProgramId)
    return result
  }
}

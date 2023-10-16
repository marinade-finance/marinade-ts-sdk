import {
  MarinadeReferralGlobalState,
  MarinadeReferralStateResponse,
} from './marinade-referral-state.types'
import { DEFAULT_MARINADE_REFERRAL_GLOBAL_STATE_ADDRESS } from '../config/marinade-config'
import { MarinadeReferralProgram } from '../programs/marinade-referral-program'
import { PublicKey } from '@solana/web3.js'

export async function fetchReferralGlobalState(
  program: MarinadeReferralProgram,
  referralGlobalState: PublicKey = DEFAULT_MARINADE_REFERRAL_GLOBAL_STATE_ADDRESS
): Promise<MarinadeReferralGlobalState> {
  const globalState = (await program.account.globalState.fetch(
    referralGlobalState
  )) as unknown as MarinadeReferralStateResponse.GlobalState

  return {
    programId: program.programId,
    address: referralGlobalState,
    ...globalState,
  }
}

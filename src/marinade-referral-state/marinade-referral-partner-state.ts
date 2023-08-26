import { web3 } from '@coral-xyz/anchor'
import {
  MarinadeReferralState,
  MarinadeReferralStateResponse,
} from './marinade-referral-state.types'
import { MarinadeReferralProgram } from '../programs/marinade-referral-program'

export async function fetchReferralState(
  program: MarinadeReferralProgram,
  referralCode: web3.PublicKey
): Promise<MarinadeReferralState> {
  const state = (await program.account.referralState.fetch(
    referralCode
  )) as unknown as MarinadeReferralStateResponse.ReferralState

  return {
    address: referralCode,
    programId: program.programId,
    ...state,
  }
}

/**
 * Fetch all the referral partners
 */
export async function getReferralPartners(
  program: MarinadeReferralProgram
): Promise<MarinadeReferralState[]> {
  const accounts = await program.provider.connection.getProgramAccounts(
    new web3.PublicKey(program.programId),
    {
      filters: [
        {
          dataSize: program.account.referralState.size + 20 + 96, // number of bytes,
        },
      ],
    }
  )
  return accounts.map(acc =>
    program.coder.types.decode<MarinadeReferralState>(
      'referralState',
      acc.account.data
    )
  ) as MarinadeReferralState[]
}

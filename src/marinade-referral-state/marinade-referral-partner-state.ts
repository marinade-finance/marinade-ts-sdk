import {
  MarinadeReferralReferralState,
  MarinadeReferralStateResponse,
} from './marinade-referral-state.types'
import { MarinadeReferralProgram } from '../programs/marinade-referral-program'
import { PublicKey } from '@solana/web3.js'

export async function fetchReferralState(
  program: MarinadeReferralProgram,
  referralCode: PublicKey
): Promise<MarinadeReferralReferralState> {
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
): Promise<MarinadeReferralReferralState[]> {
  const accounts = await program.provider.connection.getProgramAccounts(
    new PublicKey(program.programId),
    {
      filters: [
        {
          dataSize: program.account.referralState.size + 20 + 96, // number of bytes,
        },
      ],
    }
  )
  return accounts.map(acc =>
    program.coder.accounts.decode<MarinadeReferralReferralState>(
      'referralState',
      acc.account.data
    )
  ) as MarinadeReferralReferralState[]
}

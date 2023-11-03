import { MarinadeState } from '../marinade-state/marinade-state.types'
import { ConfirmOptions, Connection, Keypair, PublicKey } from '@solana/web3.js'
import { Provider, Wallet } from '@coral-xyz/anchor'
import {
  MarinadeFinanceProgram,
  marinadeFinanceProgram,
} from './marinade-finance-program'
import {
  MarinadeReferralProgram,
  marinadeReferralProgram,
} from './marinade-referral-program'
import { MarinadeReferralReferralState } from '../marinade-referral-state/marinade-referral-state.types'
import { fetchMarinadeState } from '../marinade-state/marinade-state'
import { fetchReferralState } from '../marinade-referral-state/marinade-referral-partner-state'

export interface LiquidStakingProgram {
  readonly provider: Provider
  readonly program: MarinadeFinanceProgram
  readonly marinadeState: MarinadeState
}

export interface LiquidStakingReferralProgram {
  readonly provider: Provider
  readonly program: MarinadeFinanceProgram
  readonly marinadeState: MarinadeState
  readonly referralProgram: MarinadeReferralProgram
  readonly referralState: MarinadeReferralReferralState
}

export class MarinadeProgram {
  readonly provider: Provider

  private constructor(
    readonly program: MarinadeFinanceProgram,
    readonly marinadeState: MarinadeState,
    readonly referralProgram?: MarinadeReferralProgram,
    readonly referralState?: MarinadeReferralReferralState
  ) {
    this.provider = program.provider
  }

  isReferralProgram(): this is LiquidStakingReferralProgram {
    return !!this.referralProgram && !!this.referralState
  }

  isMarinadeProgram(): this is LiquidStakingProgram {
    return this.referralState === undefined
  }

  /**
   * Initialization of the Marinade Program class that works with all instructions within the SDK.
   * This initialization differentiate to directly use Marinade
   * [liquid-staking-program]{@link https://github.com/marinade-finance/liquid-staking-program}
   * or some calls goes through the referral accounting via
   * [liquid-staking-referral-program]{@link https://github.com/marinade-finance/liquid-staking-referral-program}
   * liquid-staking-referral-program.
   *
   * The differentiator of the two programs is the `referralCode`. If the referralCode is not provided
   * then `liquid-staking-program` is used. If the referralCode is provided
   * then `liquid-staking-referral-program` is used.
   * The `referralCode` is a public key of the referral state account.
   */
  static async init({
    provider,
    marinadeProgramAddress,
    marinadeStateAddress,
    referralProgramAddress,
    referralCode,
    wallet,
    opts = {},
  }: {
    provider: Connection | Provider
    marinadeProgramAddress?: PublicKey
    marinadeStateAddress?: PublicKey
    referralProgramAddress?: PublicKey
    referralCode?: PublicKey
    wallet?: Wallet | Keypair
    opts?: ConfirmOptions
  }): Promise<MarinadeProgram> {
    const program = marinadeFinanceProgram({
      programAddress: marinadeProgramAddress,
      provider,
      wallet,
      opts,
    })
    const marinadeState = await fetchMarinadeState(
      program,
      marinadeStateAddress
    )

    let referralProgram: MarinadeReferralProgram | undefined
    let referralState: MarinadeReferralReferralState | undefined
    if (referralCode) {
      referralProgram = marinadeReferralProgram({
        programAddress: referralProgramAddress,
        provider,
        wallet,
        opts,
      })
      referralState = await fetchReferralState(referralProgram, referralCode)
    }
    return new MarinadeProgram(
      program,
      marinadeState,
      referralProgram,
      referralState
    )
  }
}

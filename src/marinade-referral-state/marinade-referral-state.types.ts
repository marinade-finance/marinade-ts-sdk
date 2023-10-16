import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export const enum ProgramDerivedAddressSeed {
  GLOBAL_STATE_SEED = 'mrp_initialize',
  REFERRAL_STATE_SEED = 'mrp_create_referral',
}

export namespace MarinadeReferralStateResponse {
  export interface GlobalState {
    adminAccount: PublicKey
    msolMintAccount: PublicKey
    foreman1: PublicKey
    foreman2: PublicKey
    minKeepPct: number
    maxKeepPct: number
  }

  export interface ReferralState {
    partnerName: string
    validatorVoteKey: PublicKey | null
    keepSelfStakePct: number
    partnerAccount: PublicKey
    msolTokenPartnerAccount: PublicKey
    depositSolAmount: BN
    depositSolOperations: BN
    depositStakeAccountAmount: BN
    depositStakeAccountOperations: BN
    liqUnstakeMsolFees: BN
    liqUnstakeSolAmount: BN
    liqUnstakeMsolAmount: BN
    liqUnstakeOperations: BN
    delayedUnstakeAmount: BN
    delayedUnstakeOperations: BN
    baseFee: number
    maxFee: number
    maxNetStake: BN
    pause: boolean
    operationDepositSolFee: number
    operationDepositStakeAccountFee: number
    operationLiquidUnstakeFee: number
    operationDelayedUnstakeFee: number
    accumDepositSolFee: BN
    accumDepositStakeAccountFee: BN
    accumLiquidUnstakeFee: BN
    accumDelayedUnstakeFee: BN
  }
}

export interface MarinadeReferralGlobalState
  extends MarinadeReferralStateResponse.GlobalState {
  address: PublicKey
  programId: PublicKey
}

export interface MarinadeReferralReferralState
  extends MarinadeReferralStateResponse.ReferralState {
  address: PublicKey
  programId: PublicKey
}

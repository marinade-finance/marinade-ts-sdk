import { web3, BN } from '@project-serum/anchor'

export const enum ProgramDerivedAddressSeed {
  GLOBAL_STATE_SEED = 'mrp_initialize',
  REFERRAL_STATE_SEED = 'mrp_create_referral',
}

export namespace MarinadeReferralStateResponse {
  export interface Fee {
    basisPoints: number
  }

  export interface GlobalState {
    adminAccount: web3.PublicKey
  }

  export interface ReferralState {
    partnerName: Uint8Array
    beneficiaryAccount: web3.PublicKey
    transferDuration: BN
    lastTransferTime: BN
    depositSolAmount: BN
    depositSolOperations: BN
    depositStakeAccountAmount: BN
    depositStakeAccountOperations: BN
    liqUnstakeMsolFees: BN
    liqUnstakeAmount: BN
    liqUnstakeOperations: BN
    delayedUnstakeAmount: BN
    delUnstakeOperations: BN
    baseFee: Fee
    maxFee: Fee
    maxNetStake: BN
    pause: boolean
  }
}

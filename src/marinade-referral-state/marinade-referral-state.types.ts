import { web3, BN } from '@project-serum/anchor'

export const enum ProgramDerivedAddressSeed {
  GLOBAL_STATE_SEED = 'mrp_initialize',
  REFERRAL_STATE_SEED = 'mrp_create_referral',
}

export namespace MarinadeReferralStateResponse {
  export interface GlobalState {
    adminAccount: web3.PublicKey
    treasuryMsolBumpSeed: number
  }

  export interface ReferralState {
    partnerName: string
    partnerAccount: web3.PublicKey
    tokenPartnerAccount: web3.PublicKey
    transferDuration: BN
    lastTransferTime: BN
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
  }
}

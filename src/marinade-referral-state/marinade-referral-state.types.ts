import { web3, BN } from '@project-serum/anchor'

export const enum ProgramDerivedAddressSeed {
  GLOBAL_STATE_SEED = 'mrp_initialize',
  REFERRAL_STATE_SEED = 'mrp_create_referral',
}

export namespace MarinadeReferralStateResponse {
  export interface GlobalState {
    adminAccount: web3.PublicKey
    paymentMint: web3.PublicKey
  }

  export interface ReferralState {
    baseFee: number
    delayedUnstakeAmount: BN
    delayedUnstakeOperations: BN
    depositSolAmount: BN
    depositSolOperations: BN
    depositStakeAccountAmount: BN
    depositStakeAccountOperations: BN
    lastTransferTime: BN
    liqUnstakeAmount: BN
    liqUnstakeMsolFees: BN
    liqUnstakeOperations: BN
    maxFee: number
    maxNetStake: BN
    partnerAccount: web3.PublicKey
    partnerName: string
    pause: boolean
    tokenPartnerAccount: web3.PublicKey
    transferDuration: BN
  }
}

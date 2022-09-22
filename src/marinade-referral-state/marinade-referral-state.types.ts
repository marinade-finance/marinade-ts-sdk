import { web3, BN } from '@project-serum/anchor'

export const enum ProgramDerivedAddressSeed {
  GLOBAL_STATE_SEED = 'mrp_initialize',
  REFERRAL_STATE_SEED = 'mrp_create_referral',
}

export namespace MarinadeReferralStateResponse {
  export interface GlobalState {
    adminAccount: web3.PublicKey
    treasuryMsolAccount: web3.PublicKey
    treasuryMsolAuthBump: number
  }

  export interface ReferralState {
    partnerName: string
    validatorVoteKey: string|null
    keepSelfStakePct: number
    partnerAccount: web3.PublicKey
    msolTokenPartnerAccount: web3.PublicKey
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

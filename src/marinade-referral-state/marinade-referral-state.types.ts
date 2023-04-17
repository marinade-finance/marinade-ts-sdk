import { web3, BN } from '@coral-xyz/anchor'

export const enum ProgramDerivedAddressSeed {
  GLOBAL_STATE_SEED = 'mrp_initialize',
  REFERRAL_STATE_SEED = 'mrp_create_referral',
}

export namespace MarinadeReferralStateResponse {
  export interface GlobalState {
    adminAccount: web3.PublicKey
    msolMintAccount: web3.PublicKey
    foreman1: web3.PublicKey
    foreman2: web3.PublicKey
    minKeepPct: number
    maxKeepPct: number
  }

  export interface ReferralState {
    partnerName: string
    validatorVoteKey: web3.PublicKey|null
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

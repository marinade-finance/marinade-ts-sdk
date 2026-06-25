import { BN, web3 } from '@coral-xyz/anchor'

// Decoded form of the on-chain StakeStatus enum ({ active: {} }, ...)
export type StakeStatus =
  | { unknown: Record<string, never> }
  | { active: Record<string, never> }
  | { deactivating: Record<string, never> }

export class StakeRecord {
  stakeAccount!: web3.PublicKey
  lastUpdateDelegatedLamports!: BN
  lastUpdateEpoch!: BN
  isEmergencyUnstaking!: boolean
  lastUpdateStatus!: StakeStatus

  constructor(args: StakeRecord) {
    Object.assign(this, args)
  }
}

import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export interface ParsedStakeAccountInfo {
  address: PublicKey
  ownerAddress: PublicKey
  authorizedStakerAddress: PublicKey | null
  authorizedWithdrawerAddress: PublicKey | null
  voterAddress: PublicKey | null
  activationEpoch: BN | null
  deactivationEpoch: BN | null
  isCoolingDown: boolean
  isLockedUp: boolean
  balanceLamports: BN | null
  stakedLamports: BN | null
}

export interface ProcessedEpochInfo {
  epoch: number
  slotIndex: number
  slotsInEpoch: number
  absoluteSlot: number
  blockHeight?: number
  transactionCount?: number
  msUntilEpochEnd: number
  msElapsed: number
  epochProgress: number
  avgSlotDuration: number
  slotsRemainingInEpoch: number
}

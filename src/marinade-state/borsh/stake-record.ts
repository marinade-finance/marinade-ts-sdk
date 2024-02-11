import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export class StakeRecord {
  stakeAccount!: PublicKey
  lastUpdateDelegatedLamports!: BN
  lastUpdateEpoch!: BN
  isEmergencyUnstaking!: number

  constructor(args: StakeRecord) {
    Object.assign(this, args)
  }
}

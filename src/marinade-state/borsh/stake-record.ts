import { BN, web3 } from '@coral-xyz/anchor'

export class StakeRecord {
  stakeAccount!: web3.PublicKey
  lastUpdateDelegatedLamports!: BN
  lastUpdateEpoch!: BN
  isEmergencyUnstaking!: number

  constructor(args: StakeRecord) {
    Object.assign(this, args)
  }
}

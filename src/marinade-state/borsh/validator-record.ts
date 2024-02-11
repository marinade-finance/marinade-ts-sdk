import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export class ValidatorRecord {
  validatorAccount!: PublicKey
  activeBalance!: BN
  score!: number
  lastStakeDeltaEpoch!: BN
  duplicationFlagBumpSeed!: number

  constructor(args: ValidatorRecord) {
    Object.assign(this, args)
  }
}

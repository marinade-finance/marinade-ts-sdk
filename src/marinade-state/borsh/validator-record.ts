import { BN, web3 } from '@coral-xyz/anchor'

export class ValidatorRecord {
  validatorAccount!: web3.PublicKey
  activeBalance!: BN
  score!: number
  lastStakeDeltaEpoch!: BN
  duplicationFlagBumpSeed!: number

  constructor(args: ValidatorRecord) {
    Object.assign(this, args)
  }
}

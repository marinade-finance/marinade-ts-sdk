import { BN, web3 } from '@coral-xyz/anchor'
import { deserializePublicKey } from './common'

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

export const validatorRecordBorshSchema = [
  [
    ValidatorRecord,
    {
      kind: 'struct',
      fields: [
        ['validatorAccount', deserializePublicKey],
        ['activeBalance', 'u64'],
        ['score', 'u32'],
        ['lastStakeDeltaEpoch', 'u64'],
        ['duplicationFlagBumpSeed', 'u8'],
      ],
    },
  ],
] as const

import { web3 } from '@project-serum/anchor'
import { deserializePublicKey } from './common'

export class StakeRecord {
  stakeAccount!: web3.PublicKey
  lastUpdateDelegatedLamports!: number
  lastUpdateEpoch!: number
  isEmergencyUnstaking!: number

  constructor(args: StakeRecord) {
    Object.assign(this, args)
  }
}

export const stakeRecordBorshSchema = [
  [StakeRecord, {
    kind: 'struct',
    fields: [
      ['stakeAccount', deserializePublicKey],
      ['lastUpdateDelegatedLamports', 'u64'],
      ['lastUpdateEpoch', 'u64'],
      ['isEmergencyUnstaking', 'u8'],
    ],
  }],
] as const

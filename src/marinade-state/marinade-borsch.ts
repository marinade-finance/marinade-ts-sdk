import { web3 } from '@project-serum/anchor'
import BN from 'bn.js'

function deserializePublicKey({ publicKey }: { publicKey: Buffer }) {
  return new web3.PublicKey(publicKey)
}

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

export class StakeRecord {
  stakeAccount!: web3.PublicKey
  lastUpdateDelegatedLamports!: number
  lastUpdateEpoch!: number
  isEmergencyUnstaking!: number

  constructor(args: StakeRecord) {
    Object.assign(this, args)
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
export const MARINADE_BORSH_SCHEMA = new Map<Function, unknown>([
  [deserializePublicKey, {
    kind: 'struct',
    fields: [
      ['publicKey', [32]],
    ],
  }],
  [ValidatorRecord, {
    kind: 'struct',
    fields: [
      ['validatorAccount', deserializePublicKey],
      ['activeBalance', 'u64'],
      ['score', 'u32'],
      ['lastStakeDeltaEpoch', 'u64'],
      ['duplicationFlagBumpSeed', 'u8'],
    ],
  }],
  [StakeRecord, {
    kind: 'struct',
    fields: [
      ['stakeAccount', deserializePublicKey],
      ['lastUpdateDelegatedLamports', 'u64'],
      ['lastUpdateEpoch', 'u64'],
      ['isEmergencyUnstaking', 'u8'],
    ],
  }],
])

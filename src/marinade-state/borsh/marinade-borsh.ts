import { commonBorshSchema } from './common'
import { validatorRecordBorshSchema } from './validator-record'
import { stakeRecordBorshSchema } from './stake-record'
import { stakeStateBorshSchema } from './stake-state'

// eslint-disable-next-line @typescript-eslint/ban-types
export const MARINADE_BORSH_SCHEMA = new Map<Function, unknown>([
  ...commonBorshSchema,
  ...validatorRecordBorshSchema,
  ...stakeRecordBorshSchema,
  ...stakeStateBorshSchema,
])

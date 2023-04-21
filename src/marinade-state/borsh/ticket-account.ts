import { BN, web3 } from '@coral-xyz/anchor'
import { deserializePublicKey } from './common'

export const TICKET_ACCOUNT_SIZE = 8 + 2 * 32 + 2 * 8

export class TicketAccount {
  stateAddress!: web3.PublicKey
  beneficiary!: web3.PublicKey
  lamportsAmount!: BN
  createdEpoch!: BN
  ticketDue?: boolean
  ticketDueDate?: Date

  constructor(args: TicketAccount) {
    Object.assign(this, args)
  }
}

export const ticketAccountBorshSchema = [
  [
    TicketAccount,
    {
      kind: 'struct',
      fields: [
        ['stateAddress', deserializePublicKey],
        ['beneficiary', deserializePublicKey],
        ['lamportsAmount', 'u64'],
        ['createdEpoch', 'u64'],
      ],
    },
  ],
] as const

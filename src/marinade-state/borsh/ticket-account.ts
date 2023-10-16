import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export const TICKET_ACCOUNT_SIZE = 8 + 2 * 32 + 2 * 8

export class TicketAccount {
  stateAddress!: PublicKey
  beneficiary!: PublicKey
  lamportsAmount!: BN
  createdEpoch!: BN
  ticketDue?: boolean
  ticketDueDate?: Date

  constructor(args: TicketAccount) {
    Object.assign(this, args)
  }
}

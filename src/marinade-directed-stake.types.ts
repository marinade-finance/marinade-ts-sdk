import { ProgramAccount } from '@coral-xyz/anchor'
import { DirectedStakeVoteRecord } from '@marinade.finance/directed-stake-sdk'
import { PublicKey } from '@solana/web3.js'

export const enum ErrorMessage {
  NO_PUBLIC_KEY = "User's public key must be provided in the configuration!",
}

export namespace DirectedStakeResult {
  export interface UserVoterRecord {
    voteRecord: ProgramAccount<DirectedStakeVoteRecord> | undefined
    address: PublicKey
  }
}

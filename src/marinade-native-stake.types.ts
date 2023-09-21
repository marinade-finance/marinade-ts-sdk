import { Keypair, TransactionInstruction } from '@solana/web3.js'

export type AuthStakeSOLIxResponse = {
  createAuthorizedStake: TransactionInstruction[]
  stakeKeypair: Keypair
}

export type UnstakeSOLIxResponse = {
  payFees: TransactionInstruction[]
  onPaid: (signature: string) => Promise<unknown>
}

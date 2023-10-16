import {
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js'

export namespace MarinadeResult {
  export interface AddLiquidity {
    associatedLPTokenAccountAddress: PublicKey
    transaction: Transaction
  }

  export interface RemoveLiquidity {
    associatedLPTokenAccountAddress: PublicKey
    associatedMSolTokenAccountAddress: PublicKey
    transaction: Transaction
  }

  export interface Deposit {
    associatedMSolTokenAccountAddress: PublicKey
    transaction: Transaction
  }

  export interface LiquidUnstake {
    associatedMSolTokenAccountAddress: PublicKey
    transaction: Transaction
  }

  export interface DepositStakeAccount {
    associatedMSolTokenAccountAddress: PublicKey
    voterAddress: PublicKey
    transaction: Transaction
    mintRatio: number
  }

  export interface DepositDeactivatingStakeAccount {
    associatedMSolTokenAccountAddress: PublicKey
    transaction: Transaction
  }

  export interface PartiallyDepositStakeAccount {
    associatedMSolTokenAccountAddress: PublicKey
    stakeAccountKeypair?: Keypair
    voterAddress?: PublicKey
    transaction: Transaction
  }

  export interface LiquidateStakeAccount {
    associatedMSolTokenAccountAddress: PublicKey
    voterAddress: PublicKey
    transaction: Transaction
  }

  export interface OrderUnstake {
    ticketAccountKeypair: Keypair
    associatedMSolTokenAccountAddress: PublicKey
    transaction: Transaction
  }

  export interface Claim {
    transaction: Transaction
  }

  export interface LiquidateStakePoolToken {
    associatedMSolTokenAccountAddress: PublicKey
    transaction: VersionedTransaction
  }
}

export interface DepositOptions {
  /**
   * The address of the owner account for the associated mSOL account.
   */
  mintToOwnerAddress?: PublicKey
  /**
   * The vote address of the validator to direct your stake to.
   */
  directToValidatorVoteAddress?: PublicKey
}

export interface DepositStakeAccountOptions {
  /**
   * The vote address of the validator to direct your stake to.
   */
  directToValidatorVoteAddress?: PublicKey
}

export interface ValidatorStats {
  identity: string
  vote_account: string
  info_name?: string
  info_url: string
  info_keybase?: string
  version: string
  decentralizer_stake: string
  superminority: boolean
  credits: number
  score: number
  epochs_count: number
  avg_apy?: number
  avg_uptime_pct?: number
}

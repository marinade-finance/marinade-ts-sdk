import { web3 } from '@coral-xyz/anchor'

export const enum ErrorMessage {
  NO_PUBLIC_KEY = "User's public key must be provided in the configuration!",
}

export namespace MarinadeResult {
  export interface AddLiquidity {
    associatedLPTokenAccountAddress: web3.PublicKey
    transaction: web3.Transaction
  }

  export interface RemoveLiquidity {
    associatedLPTokenAccountAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    transaction: web3.Transaction
  }

  export interface Deposit {
    associatedMSolTokenAccountAddress: web3.PublicKey
    transaction: web3.Transaction
  }

  export interface LiquidUnstake {
    associatedMSolTokenAccountAddress: web3.PublicKey
    transaction: web3.Transaction
  }

  export interface DepositStakeAccount {
    associatedMSolTokenAccountAddress: web3.PublicKey
    voterAddress: web3.PublicKey
    transaction: web3.Transaction
    mintRatio: number
  }

  export interface DepositDeactivatingStakeAccount {
    associatedMSolTokenAccountAddress: web3.PublicKey
    transaction: web3.Transaction
  }

  export interface PartiallyDepositStakeAccount {
    associatedMSolTokenAccountAddress: web3.PublicKey
    stakeAccountKeypair?: web3.Keypair
    voterAddress?: web3.PublicKey
    transaction: web3.Transaction
  }

  export interface LiquidateStakeAccount {
    associatedMSolTokenAccountAddress: web3.PublicKey
    voterAddress: web3.PublicKey
    transaction: web3.Transaction
  }

  export interface OrderUnstake {
    ticketAccountKeypair: web3.Keypair
    associatedMSolTokenAccountAddress: web3.PublicKey
    transaction: web3.Transaction
  }

  export interface Claim {
    transaction: web3.Transaction
  }

  export interface LiquidateStakePoolToken {
    associatedMSolTokenAccountAddress: web3.PublicKey
    transaction: web3.VersionedTransaction
  }
}

export interface DepositOptions {
  /**
   * The address of the owner account for the associated mSOL account.
   */
  mintToOwnerAddress?: web3.PublicKey
  /**
   * The vote address of the validator to direct your stake to.
   */
  directToValidatorVoteAddress?: web3.PublicKey
}

export interface DepositStakeAccountOptions {
  /**
   * The vote address of the validator to direct your stake to.
   */
  directToValidatorVoteAddress?: web3.PublicKey
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

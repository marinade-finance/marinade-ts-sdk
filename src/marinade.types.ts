import { web3 } from '@project-serum/anchor'

export const enum ErrorMessage {
  NO_PUBLIC_KEY = `User's public key must be provided in the configuration!`,
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

  export interface LiquidateStakeAccount {
    associatedMSolTokenAccountAddress: web3.PublicKey
    voterAddress: web3.PublicKey
    transaction: web3.Transaction
  }
}

export interface DepositOptions {
  /**
   * The address of the owner account for the associated mSOL account.
   */
  mintToOwnerAddress?: web3.PublicKey
}

import { web3 } from '@project-serum/anchor'

export namespace MarinadeResult {
  export interface AddLiquidity {
    associatedLPTokenAccountAddress: web3.PublicKey
    transactionSignature: string
  }

  export interface RemoveLiquidity {
    associatedLPTokenAccountAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    transactionSignature: string
  }

  export interface Deposit {
    associatedMSolTokenAccountAddress: web3.PublicKey
    transactionSignature: string
  }

  export interface LiquidUnstake {
    associatedMSolTokenAccountAddress: web3.PublicKey
    transactionSignature: string
  }

  export interface DepositStakeAccount {
    associatedMSolTokenAccountAddress: web3.PublicKey
    voterAddress: web3.PublicKey
    transactionSignature: string
  }
}

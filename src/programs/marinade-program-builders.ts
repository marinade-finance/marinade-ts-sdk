import { BN, web3 } from '@coral-xyz/anchor'
import { MarinadeState } from '../marinade-state/marinade-state.types'

export interface MarinadeProgramBuilders {
  liquidUnstakeInstructionBuilder({
    marinadeState,
    ownerAddress,
    associatedMSolTokenAccountAddress,
    amountLamports,
  }: {
    marinadeState: MarinadeState
    ownerAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    amountLamports: BN
  }): Promise<web3.TransactionInstruction>

  depositInstructionBuilder({
    marinadeState,
    transferFrom,
    associatedMSolTokenAccountAddress,
    amountLamports,
  }: {
    marinadeState: MarinadeState
    transferFrom: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    amountLamports: BN
  }): Promise<web3.TransactionInstruction>

  depositStakeAccountInstructionBuilder({
    marinadeState,
    duplicationFlag,
    ownerAddress,
    stakeAccountAddress,
    authorizedWithdrawerAddress,
    associatedMSolTokenAccountAddress,
    validatorIndex,
  }: {
    marinadeState: MarinadeState
    duplicationFlag: web3.PublicKey
    ownerAddress: web3.PublicKey
    stakeAccountAddress: web3.PublicKey
    authorizedWithdrawerAddress: web3.PublicKey
    associatedMSolTokenAccountAddress: web3.PublicKey
    validatorIndex: number
  }): Promise<web3.TransactionInstruction>
}

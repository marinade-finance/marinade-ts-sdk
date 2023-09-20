import {
  PublicKey,
  TransactionInstruction,
  VersionedTransaction,
} from '@solana/web3.js'
import BN from 'bn.js'
import { NativeStakingSDK } from '@marinade.finance/native-staking-sdk'
import {
  AuthStakeSOLIxResponse,
  UnstakeSOLIxResponse,
} from './marinade-native-stake.types'

/**
 * Fetches the instruction to stake SOL in Marinade Native
 *
 * @param {PublicKey} userPublicKey - The PublicKey of the user
 * @param {BN} amountToStake - The amount to deposit in lamports
 * @returns {AuthStakeSOLIxResponse} - The instructions to add in transaction to stake in Marinade Native and new stake keypair
 */
export function getAuthNativeStakeSOLIx({
  userPublicKey,
  amountToStake,
}: {
  userPublicKey: PublicKey
  amountToStake: BN
}): AuthStakeSOLIxResponse {
  const nativeSdk = new NativeStakingSDK()
  return nativeSdk.buildCreateAuthorizedStakeInstructions(
    userPublicKey,
    amountToStake
  )
}

/**
 * Fetches the transaction to stake SOL in Marinade Native with refCode
 *
 * @param {PublicKey} userPublicKey - The PublicKey of the user
 * @param {BN} amountToStake - The amount to deposit in lamports
 * @param {string} mNativeRefCode - Marinade Native referral code
 * @returns {Promise<VersionedTransaction>} - The transaction to stake SOL into Marinade native using Referral Code
 */
export async function getRefNativeStakeSOLTx({
  userPublicKey,
  amountToStake,
  mNativeRefCode,
}: {
  userPublicKey: PublicKey
  amountToStake: BN
  mNativeRefCode: string
}): Promise<VersionedTransaction> {
  const response = await fetch(
    `https://native-staking-referral.marinade.finance/v1/tx/deposit-sol?amount=${amountToStake.toString()}&code=${mNativeRefCode}&user=${userPublicKey.toString()}`
  )
  const serializedTx = await response.json()

  const txBuffer = Buffer.from(serializedTx, 'base64')
  return VersionedTransaction.deserialize(txBuffer)
}

/**
 * Fetches the instruction to stake Stake Account in Marinade Native
 *
 * @param {PublicKey} userPublicKey - The PublicKey of the user
 * @param {PublicKey[]} stakeAccounts - The stake accounts that are about to be deposited in Marinade Native
 * @returns {TransactionInstruction} - The instruction to add in transaction to stake in Marinade Native
 */
export function getAuthNativeStakeAccountIx({
  userPublicKey,
  stakeAccounts,
}: {
  userPublicKey: PublicKey
  stakeAccounts: PublicKey[]
}): TransactionInstruction[] {
  const nativeSdk = new NativeStakingSDK()
  return nativeSdk.buildAuthorizeInstructions(userPublicKey, stakeAccounts)
}

/**
 * Fetches the transaction to deposit Stake Account in Marinade Native with refCode
 *
 * @param {PublicKey} userPublicKey - The PublicKey of the user
 * @param {PublicKey} stakeAccountAddress - The stake account to be deposited into Marinade Native
 * @param {string} mNativeRefCode - Marinade Native referral code
 * @returns {Promise<VersionedTransaction>} - The transaction to deposit Stake Account into Marinade native using Referral Code
 */
export async function getRefNativeStakeAccountTx({
  userPublicKey,
  stakeAccountAddress,
  mNativeRefCode,
}: {
  userPublicKey: PublicKey
  stakeAccountAddress: PublicKey
  mNativeRefCode: string
}): Promise<VersionedTransaction> {
  const response = await fetch(
    `https://native-staking-referral.marinade.finance/v1/tx/deposit-stake-account?stake=${stakeAccountAddress.toString()}&code=${mNativeRefCode}&user=${userPublicKey.toString()}`
  )

  const serializedTx = await response.json()

  const txBuffer = Buffer.from(serializedTx, 'base64')
  return VersionedTransaction.deserialize(txBuffer)
}

/**
 * Fetches the instruction to unstake from Marinade Native
 *
 * @param {PublicKey} userPublicKey - The PublicKey of the user
 * @param {BN} amountToUnstake - The amount to unstake in lamports
 * @returns {UnstakeSOLIxResponse} - The instructions to pay the fee for unstake and the event that should be called after fee is paid in order to trigger unstake event faster (calling this is optional, but it ensures better experience for user).
 */
export async function getPrepareNativeUnstakeSOLIx({
  userPublicKey,
  amountToUnstake,
}: {
  userPublicKey: PublicKey
  amountToUnstake: BN
}): Promise<UnstakeSOLIxResponse> {
  const nativeSdk = new NativeStakingSDK()
  return await nativeSdk.initPrepareForRevoke(userPublicKey, amountToUnstake)
}

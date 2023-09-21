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
 * Retrieves the instruction for staking SOL with Marinade Native.
 *
 * @param {PublicKey} userPublicKey - The PublicKey associated with the user.
 * @param {BN} amountToStake - The amount to be staked, in lamports.
 * @returns {AuthStakeSOLIxResponse} - The instructions to include in the transaction for staking in Marinade Native, along with the new stake keypair.
 */
export function getAuthNativeStakeSOLIx(
  userPublicKey: PublicKey,
  amountToStake: BN
): AuthStakeSOLIxResponse {
  const nativeSdk = new NativeStakingSDK()
  return nativeSdk.buildCreateAuthorizedStakeInstructions(
    userPublicKey,
    amountToStake
  )
}

/**
 * Retrieves the transaction for staking SOL with Marinade Native using a referral code.
 *
 * @param {PublicKey} userPublicKey - The PublicKey associated with the user.
 * @param {BN} amountToStake - The amount to be staked, specified in lamports.
 * @param {string} mNativeRefCode - The Marinade Native referral code.
 * @returns {Promise<VersionedTransaction>} - A promise that resolves to the transaction for staking SOL with Marinade Native using the referral code.
 */
export async function getRefNativeStakeSOLTx(
  userPublicKey: PublicKey,
  amountToStake: BN,
  mNativeRefCode: string
): Promise<VersionedTransaction> {
  const response = await fetch(
    `https://native-staking-referral.marinade.finance/v1/tx/deposit-sol?amount=${amountToStake.toString()}&code=${mNativeRefCode}&user=${userPublicKey.toString()}`
  )
  const result = await response.json()

  const txBuffer = Buffer.from(result.serializedTx, 'base64')
  return VersionedTransaction.deserialize(txBuffer)
}

/**
 * Retrieves the instruction for staking a Stake Account with Marinade Native.
 *
 * @param {PublicKey} userPublicKey - The PublicKey associated with the user.
 * @param {PublicKey[]} stakeAccounts - The stake accounts to be used with Marinade Native.
 * @returns {TransactionInstruction} - The instruction to include in the transaction for staking the Stake Account with Marinade Native.
 */
export function getAuthNativeStakeAccountIx(
  userPublicKey: PublicKey,
  stakeAccounts: PublicKey[]
): TransactionInstruction[] {
  const nativeSdk = new NativeStakingSDK()
  return nativeSdk.buildAuthorizeInstructions(userPublicKey, stakeAccounts)
}

/**
 * Retrieves the transaction for using a Stake Account with Marinade Native via a referral code.
 *
 * @param {PublicKey} userPublicKey - The PublicKey associated with the user.
 * @param {PublicKey} stakeAccountAddress - The address of the stake account intended to use with Marinade Native.
 * @param {string} mNativeRefCode - The Marinade Native referral code.
 * @returns {Promise<VersionedTransaction>} - A promise resolving to the transaction required for using the Stake Account with Marinade Native via the given referral code.
 */
export async function getRefNativeStakeAccountTx(
  userPublicKey: PublicKey,
  stakeAccountAddress: PublicKey,
  mNativeRefCode: string
): Promise<VersionedTransaction> {
  const response = await fetch(
    `https://native-staking-referral.marinade.finance/v1/tx/deposit-stake-account?stake=${stakeAccountAddress.toString()}&code=${mNativeRefCode}&user=${userPublicKey.toString()}`
  )

  const result = await response.json()

  const txBuffer = Buffer.from(result.serializedTx, 'base64')
  return VersionedTransaction.deserialize(txBuffer)
}

/**
 * Retrieves the instruction for unstaking from Marinade Native.
 *
 * @param {PublicKey} userPublicKey - The PublicKey associated with the user.
 * @param {BN} amountToUnstake - The amount to be unstaked, specified in lamports.
 * @returns {UnstakeSOLIxResponse} - The instructions for paying the unstaking fee and an optional event that can be called after the fee is paid to expedite the unstaking process (calling this event is optional but enhances the user experience).
 */
export async function getPrepareNativeUnstakeSOLIx(
  userPublicKey: PublicKey,
  amountToUnstake: BN
): Promise<UnstakeSOLIxResponse> {
  const nativeSdk = new NativeStakingSDK()
  return await nativeSdk.initPrepareForRevoke(userPublicKey, amountToUnstake)
}

/**
 * Invokes the bot to rebalance the user's funds. This is particularly useful immediately following a deposit into Marinade Native, although it is not mandatory.
 *
 * @param {PublicKey} userPublicKey - The PublicKey associated with the user.
 */
export async function callRebalanceHint(
  userPublicKey: PublicKey
): Promise<void> {
  const nativeSdk = new NativeStakingSDK()
  return await nativeSdk.callRebalanceHint(userPublicKey)
}

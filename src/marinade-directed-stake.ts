import {
  DEFAULT_DIRECTED_STAKE_ROOT,
  DirectedStakeSdk,
  findVoteRecords,
  voteRecordAddress,
  withCreateVote,
  withRemoveVote,
  withUpdateVote,
} from '@marinade.finance/directed-stake-sdk'
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js'
import { assertNotDefault, assertNotUndefinedAndReturn } from './util/assert'
import {
  DirectedStakeResult,
  ErrorMessage,
} from './marinade-directed-stake.types'

/**
 * Constructs a DirectedStake contract SDK.
 *
 * @param connection - RPC connection to the Solana cluster
 * @param walletPublicKey - the user wallet public key that the SDK works with as default value
 * @returns directed stake sdk
 */
export function getDirectedStakeSdk(
  connection: Connection,
  walletPublicKey: PublicKey
): DirectedStakeSdk {
  return new DirectedStakeSdk({
    connection,
    wallet: {
      signTransaction: async () => new Promise(() => new Transaction()),
      signAllTransactions: async () => new Promise(() => [new Transaction()]),
      publicKey: walletPublicKey,
    },
  })
}

/**
 * Creates necessary directed stake voting instructions for the specified validator.
 * If the vote address is left undefined the standard delegation strategy is used.
 *
 * @param {DirectedStakeSdk} directedStakeSdk - The DirectedStakeSdk instance
 * @param {PublicKey} validatorVoteAddress - The vote address to identify the validator
 */
export async function createDirectedStakeVoteIx(
  directedStakeSdk: DirectedStakeSdk,
  validatorVoteAddress?: PublicKey
): Promise<TransactionInstruction | undefined> {
  const owner = assertNotUndefinedAndReturn(
    directedStakeSdk.program.provider.publicKey,
    ErrorMessage.NO_PUBLIC_KEY
  )
  // default key would mean not defined in the config
  assertNotDefault(owner, ErrorMessage.NO_PUBLIC_KEY)
  const { voteRecord } = await getUserVoteRecord(directedStakeSdk, owner)

  if (!voteRecord) {
    if (validatorVoteAddress) {
      return (
        await withCreateVote({
          sdk: directedStakeSdk,
          validatorVote: validatorVoteAddress,
        })
      ).instruction
    }
    return
  }

  if (validatorVoteAddress) {
    return (
      await withUpdateVote({
        sdk: directedStakeSdk,
        validatorVote: validatorVoteAddress,
        voteRecord: voteRecord.publicKey,
      })
    ).instruction
  }

  return (
    await withRemoveVote({
      sdk: directedStakeSdk,
      voteRecord: voteRecord.publicKey,
    })
  ).instruction
}

/**
 * Fetches the voteRecord of a given user
 *
 * @param {PublicKey} userPublicKey - The PublicKey of the user
 * @param {DirectedStakeSdk} directedStakeSdk - The DirectedStakeSdk instance
 * @returns {Promise<{voteRecord: ProgramAccount<DirectedStakeVoteRecord> | undefined, address: PublicKey}>} - The voteRecord and its address
 */
export async function getUserVoteRecord(
  directedStakeSdk: DirectedStakeSdk,
  userPublicKey: PublicKey
): Promise<DirectedStakeResult.UserVoterRecord> {
  const address = voteRecordAddress({
    root: new PublicKey(DEFAULT_DIRECTED_STAKE_ROOT),
    owner: userPublicKey,
  }).address

  const voteRecords = await findVoteRecords({
    sdk: directedStakeSdk,
    owner: userPublicKey,
  })

  return {
    voteRecord: voteRecords.length === 1 ? voteRecords[0] : undefined,
    address,
  }
}

import { Connection, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

/**
 * EpochStatus represents the current state of the epoch.
 * - OPERABLE: Normal state where interactions with stake accounts are possible.
 * - PRE_EPOCH: The epoch is nearing its end; operations may not complete in time.
 * - REWARDS_DISTRIBUTION: Rewards are actively being distributed to stake accounts.
 */
export enum EpochStatus {
  OPERABLE,
  PRE_EPOCH,
  REWARDS_DISTRIBUTION,
}

export type EpochRewardsInfo = {
  distributionStartingBlockHeight?: BN
  numPartitions?: BN
  parentBlockhash?: string
  totalPoints?: BN
  totalRewards?: BN
  distributedRewards?: BN
  active?: boolean
}

/**
 * Determines the current status of the epoch based on slot information and rewards data.
 *
 * @param absolutSlot - The current absolute slot number.
 * @param noOfStakeAccounts - Total number of stake accounts (default is 1,500,000).
 * @param skipRate - The rate of skipped slots, between 0 and 1 (default is 0.1 or 10%).
 * @param warningNoSlotsBeforeEpochEnd - Number of slots before epoch end to trigger PRE_EPOCH status.
 * @param epochRewardsInfo - Optional object containing the current epoch rewards data.
 *
 * @returns EpochStatus - The current status of the epoch:
 *                        - REWARDS_DISTRIBUTION: Rewards are being distributed.
 *                        - PRE_EPOCH: Epoch is about to end.
 *                        - OPERABLE: Epoch is in a normal operating state.
 */
export function getEpochStatus({
  absolutSlot,
  noOfStakeAccounts = 1500000,
  skipRate = 0.1,
  warningNoSlotsBeforeEpochEnd = 500,
  epochRewardsInfo,
}: {
  absolutSlot: number
  noOfStakeAccounts?: number
  skipRate?: number
  warningNoSlotsBeforeEpochEnd?: number
  epochRewardsInfo?: EpochRewardsInfo
}) {
  // It takes around 4096 stake accounts per block to receive rewards.
  // Given the total number of stake accounts on chain we should compute
  // the number of blocks needed to distribute all the staking rewards taking into account skipRate
  const slotsToPayRewards = Math.ceil(noOfStakeAccounts / 4096 / (1 - skipRate))
  // Amount of blocks to signal that the epoch is about to end and
  // transactions interacting with stake accounts might not make it within current epoch
  const slotsPreEpoch = 432000 - warningNoSlotsBeforeEpochEnd
  const slotIndex = absolutSlot % 432000

  if (epochRewardsInfo?.active || slotIndex <= slotsToPayRewards) {
    return EpochStatus.REWARDS_DISTRIBUTION
  } else if (slotIndex >= slotsPreEpoch) {
    return EpochStatus.PRE_EPOCH
  }

  return EpochStatus.OPERABLE
}

/**
 * Fetches the current rewards distribution state from the SysvarEpochRewards account.
 *
 * @param connection - A Solana Connection object used to query on-chain data.
 *
 * @returns Promise<EpochRewardsInfo> - Returns an object containing rewards information,
 *                                      such as total rewards, distributed rewards, and the active state that reflects if reward distribution is still running.
 * @throws Error - If the SysvarEpochRewards account data cannot be fetched.
 */
export async function getParsedEpochRewards(
  connection: Connection
): Promise<EpochRewardsInfo> {
  const accountInfo = await connection.getAccountInfo(
    new PublicKey('SysvarEpochRewards1111111111111111111111111')
  )

  if (!accountInfo) {
    throw new Error('SysvarEpochRewards account info could not be fetched.')
  }

  const distributionStartingBlockHeight = new BN(
    accountInfo.data.subarray(0, 8),
    'le'
  )
  const numPartitions = new BN(accountInfo.data.subarray(8, 16), 'le')
  const parentBlockhash = accountInfo.data.subarray(16, 48).toString('hex')
  const totalPoints = new BN(accountInfo.data.subarray(48, 64), 'le')
  const totalRewards = new BN(accountInfo.data.subarray(64, 72), 'le')
  const distributedRewards = new BN(accountInfo.data.subarray(72, 80), 'le')
  const active = Boolean(accountInfo.data.readUInt8(80))

  return {
    distributionStartingBlockHeight,
    numPartitions,
    parentBlockhash,
    totalPoints,
    totalRewards,
    distributedRewards,
    active,
  }
}

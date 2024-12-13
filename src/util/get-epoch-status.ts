export enum EpochStatus {
  OPERABLE,
  PRE_EPOCH,
  REWARDS_DISTRIBUTION,
}

export function getEpochStatus(slotIndex: number, noOfStakeAccounts = 1500000) {
  // It takes around 4096 stake accounts per block to receive rewards.
  // Given the total number of stake accounts on chain we should compute
  // the number of blocks needed to distribute all the staking rewards
  const slotsToPayRewards = Math.ceil(noOfStakeAccounts / 4096)
  // An arbitrary amount of blocks to signal that the epoch is about to end
  // and transactions interacting with stake accounts might not make it within current epoch
  const slotsPreEpoch = 432000 - 500

  if (slotIndex <= slotsToPayRewards) {
    return EpochStatus.REWARDS_DISTRIBUTION
  } else if (slotIndex >= slotsPreEpoch) {
    return EpochStatus.PRE_EPOCH
  }

  return EpochStatus.OPERABLE
}

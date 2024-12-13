import { EpochStatus, getEpochStatus } from './get-epoch-status'

const mockEpochInfo = (
  absoluteSlot: number,
  epoch: number,
  slotsInEpoch: number
) => ({
  absoluteSlot,
  epoch,
  slotsInEpoch,
  slotIndex: absoluteSlot % slotsInEpoch,
})

describe('getEpochStatus', () => {
  it('should return REWARDS_DISTRIBUTION when slotsPassed is less than or equal to slotsToPayRewards', () => {
    const epochInfo = mockEpochInfo(307152300, 711, 432000)
    const status = getEpochStatus(epochInfo.slotIndex)
    expect(status).toBe(EpochStatus.REWARDS_DISTRIBUTION)
  })

  it('should return PRE_EPOCH when timeRemaining is less than 300 seconds', () => {
    const epochInfo = mockEpochInfo(307583750, 711, 432000)
    const status = getEpochStatus(epochInfo.slotIndex)
    expect(status).toBe(EpochStatus.PRE_EPOCH)
  })

  it('should return OPERABLE when neither REWARDS_DISTRIBUTION nor PRE_EPOCH conditions are met', () => {
    const epochInfo = mockEpochInfo(307193449, 711, 432000)
    const status = getEpochStatus(epochInfo.slotIndex)
    expect(status).toBe(EpochStatus.OPERABLE)
  })

  it('should correctly return REWARDS_DISTRIBUTION when slotsPassed equals slotsToPayRewards', () => {
    const epochInfo = mockEpochInfo(307152367, 711, 432000)
    const status = getEpochStatus(epochInfo.slotIndex)
    expect(status).toBe(EpochStatus.REWARDS_DISTRIBUTION)
  })

  it('should correctly return PRE_EPOCH when timeRemaining is exactly 500 slots before epoch ends', () => {
    const epochInfo = mockEpochInfo(307583500, 711, 432000)
    const status = getEpochStatus(epochInfo.slotIndex)
    expect(status).toBe(EpochStatus.PRE_EPOCH)
  })

  it('should handle custom number of stake accounts correctly', () => {
    const epochInfo = mockEpochInfo(307152245, 711, 432000)
    const status = getEpochStatus(epochInfo.slotIndex, 1000000)
    expect(status).toBe(EpochStatus.REWARDS_DISTRIBUTION)
  })
})

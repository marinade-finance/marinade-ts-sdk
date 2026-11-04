import { slotDurationMsFromSamples } from './slot-duration'

describe('slotDurationMsFromSamples', () => {
  it('pools total seconds over total slots, not a mean of ratios', () => {
    expect(
      slotDurationMsFromSamples([
        { numSlots: 190, samplePeriodSecs: 100 },
        { numSlots: 10, samplePeriodSecs: 10 },
      ])
    ).toBeCloseTo((110 * 1000) / 200, 9)
  })

  it('skips windows without slots instead of counting their seconds', () => {
    expect(
      slotDurationMsFromSamples([
        { numSlots: 0, samplePeriodSecs: 60 },
        { numSlots: 300, samplePeriodSecs: 60 },
      ])
    ).toBe(200)
  })

  it('skips windows without seconds and malformed samples', () => {
    const samples = [
      { numSlots: 150, samplePeriodSecs: 0 },
      { numSlots: 'lots', samplePeriodSecs: 60 },
      { numSlots: NaN, samplePeriodSecs: 60 },
      { numSlots: 300, samplePeriodSecs: 60 },
    ] as unknown as { numSlots: number; samplePeriodSecs: number }[]
    expect(slotDurationMsFromSamples(samples)).toBe(200)
  })

  it('returns null when no window is usable', () => {
    expect(slotDurationMsFromSamples([])).toBeNull()
    expect(
      slotDurationMsFromSamples([{ numSlots: 0, samplePeriodSecs: 0 }])
    ).toBeNull()
  })

  it('returns null on a stalled cluster', () => {
    expect(
      slotDurationMsFromSamples([{ numSlots: 3, samplePeriodSecs: 60 }])
    ).toBeNull()
  })

  it('returns null on an implausibly fast rate', () => {
    expect(
      slotDurationMsFromSamples([{ numSlots: 6000, samplePeriodSecs: 60 }])
    ).toBeNull()
  })

  it('keeps the edges of the plausible range', () => {
    expect(
      slotDurationMsFromSamples([{ numSlots: 1200, samplePeriodSecs: 60 }])
    ).toBe(50)
    expect(
      slotDurationMsFromSamples([{ numSlots: 30, samplePeriodSecs: 60 }])
    ).toBe(2000)
  })
})

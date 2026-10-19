export interface SlotDurationSample {
  numSlots: number
  samplePeriodSecs: number
}

export const SLOT_DURATION_SAMPLE_COUNT = 60

// A stalled cluster still reports well-formed windows; outside this band the samples describe a stall, not a rate.
const MIN_SLOT_DURATION_MS = 50
const MAX_SLOT_DURATION_MS = 2000

// Pooled ms per slot from getRecentPerformanceSamples; null when no plausible rate.
export function slotDurationMsFromSamples(
  samples: SlotDurationSample[]
): number | null {
  let slots = 0
  let seconds = 0
  for (const sample of samples) {
    if (
      typeof sample?.numSlots !== 'number' ||
      typeof sample?.samplePeriodSecs !== 'number' ||
      !(sample.numSlots > 0) ||
      !(sample.samplePeriodSecs > 0)
    ) {
      continue
    }
    slots += sample.numSlots
    seconds += sample.samplePeriodSecs
  }
  if (slots === 0) {
    return null
  }
  const slotDurationMs = (seconds * 1000) / slots
  return slotDurationMs >= MIN_SLOT_DURATION_MS &&
    slotDurationMs <= MAX_SLOT_DURATION_MS
    ? slotDurationMs
    : null
}

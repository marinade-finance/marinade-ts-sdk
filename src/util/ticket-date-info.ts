/**
 * Calculates the due date information for a ticket.
 *
 * @param {number} currentEpoch
 * @param {number} createdEpoch
 * @param {number} avgSlotDuration
 */

import { ProcessedEpochInfo } from "./anchor.types"
import { TicketDateInfo } from "./ticket-date-info.types"

// https://docs.marinade.finance/marinade-protocol/system-overview#delayed-unstaked
const EXTRA_WAIT_MILLISECONDS = 1000 * 60 * 60 * 4 + 1000 * 60 * 45

export function getTicketDateInfo(currentEpoch: ProcessedEpochInfo, createdEpochNumber: number, currentTime:number = Date.now()): TicketDateInfo {
  
  const currentEpochStart = currentTime - currentEpoch.msElapsed
  const currentEpochEnd = currentTime + currentEpoch.msUntilEpochEnd
  const estimatedEpochDuration = currentEpoch.avgSlotDuration * currentEpoch.slotsInEpoch

  if (createdEpochNumber < currentEpoch.epoch) {
    const dueDate = 
      new Date((currentEpochStart + EXTRA_WAIT_MILLISECONDS) - estimatedEpochDuration * (currentEpoch.epoch - createdEpochNumber - 1))
    return {  ticketDue: true, 
      ticketDueDate: dueDate,
    }
  }

  return { ticketDue: false, ticketDueDate: new Date(currentEpochEnd + EXTRA_WAIT_MILLISECONDS) }

}

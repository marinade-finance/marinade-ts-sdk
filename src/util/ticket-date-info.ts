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
const EXTRA_WAIT_MILLISECONDS =  1000 * 60 * 45

export function getTicketDateInfo(
  currentEpoch: ProcessedEpochInfo,
  createdEpochNumber: number,
  currentTime: number = Date.now()
): TicketDateInfo {
  const currentEpochStart = currentTime - currentEpoch.msElapsed
  const estimatedEpochDuration =
    currentEpoch.avgSlotDuration * currentEpoch.slotsInEpoch
  const dueDate = 
      currentEpochStart -
        estimatedEpochDuration * (currentEpoch.epoch - createdEpochNumber - 1) + EXTRA_WAIT_MILLISECONDS
    
  return { ticketDue: dueDate < currentTime, ticketDueDate: new Date(dueDate) }
}


export function estimateTicketDateInfo(
  currentEpoch: ProcessedEpochInfo,
  currentTime: number = Date.now(),
  slotsForStakeDelta: number
): TicketDateInfo {
  
  const currentEpochEnd = currentTime + currentEpoch.msUntilEpochEnd
  const estimatedEpochDuration =
    currentEpoch.avgSlotDuration * currentEpoch.slotsInEpoch

  const dueDate = ((slotsForStakeDelta > currentEpoch.slotsRemainingInEpoch) ? 
    currentEpochEnd + estimatedEpochDuration : currentEpochEnd) + EXTRA_WAIT_MILLISECONDS


  return {
    ticketDue: false,
    ticketDueDate: new Date(dueDate),
  }
}


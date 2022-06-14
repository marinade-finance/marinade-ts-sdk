import { getTicketDateInfo } from './ticket-date-info'
import { ProcessedEpochInfo } from "./anchor.types"

const EXTRA_WAIT_MILLISECONDS = 1000 * 60 * 60 * 4 + 1000 * 60 * 45

const currentEpoch: ProcessedEpochInfo = {
  slotsInEpoch: 432000, 
  absoluteSlot: 137505844, 
  epoch: 318, 
  msElapsed: 95225546,
  msUntilEpochEnd: 221596455, 
  avgSlotDuration: 733,
  slotIndex: 129844,
  epochProgress: 30,
}

describe('ticket-date-info', () => {

  describe('getTicketDateInfo', () => {
    it('ticket date info created same epoch is correct', () => {
      const actualResult = getTicketDateInfo(currentEpoch, 318, 1655201767918) 
     
      expect(actualResult).toEqual({ticketDueDate: new Date(1655201767918 + 221596455 + EXTRA_WAIT_MILLISECONDS), ticketDue: false})
    })
    it('ticket date info created previous epoch is correct', () => {
      const actualResult = getTicketDateInfo(currentEpoch, 317, 1655201767918) 
     
      expect(actualResult).toEqual({ticketDueDate: new Date(1655201767918 - 95225546 + EXTRA_WAIT_MILLISECONDS), ticketDue: true})
    })
    it('ticket date info created 3 epochs ago is correct', () => {
      const actualResult = getTicketDateInfo(currentEpoch, 315, 1655201767918) 
     
      expect(actualResult).toEqual({ticketDueDate: new Date('2022-06-06T04:38:50.372Z'), ticketDue: true})
    })
 
  })

})
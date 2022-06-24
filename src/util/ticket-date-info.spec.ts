import { getTicketDateInfo, estimateTicketDateInfo} from "./ticket-date-info"
import { ProcessedEpochInfo } from "./anchor.types"


const currentEpoch: ProcessedEpochInfo = {
  slotsInEpoch: 432000,
  absoluteSlot: 137505844,
  epoch: 318,
  msElapsed: 95225546,
  msUntilEpochEnd: 221596455,
  avgSlotDuration: 733,
  slotIndex: 129844,
  epochProgress: 30,
  slotsRemainingInEpoch: 20000,
}

describe("ticket-date-info", () => {
  describe("getTicketDateInfo", () => {
    it("ticket date info created same epoch is not due and correct", () => {
      const actualResult = getTicketDateInfo(currentEpoch, 318, 1655201767918)

      expect(actualResult).toEqual({
        ticketDueDate: new Date("2022-06-17T00:31:38.372Z"),
        ticketDue: false,
      })
    })
    it("ticket date info created previous epoch is due and correct", () => {
      const actualResult = getTicketDateInfo(currentEpoch, 317, 1655201767918)

      expect(actualResult).toEqual({
        ticketDueDate: new Date("2022-06-13T08:34:02.372Z"),
        ticketDue: true,
      })
    })
    it("ticket date info created 3 epochs ago is due and correct", () => {
      const actualResult = getTicketDateInfo(currentEpoch, 315, 1655201767918)

      expect(actualResult).toEqual({
        ticketDueDate: new Date("2022-06-06T00:38:50.372Z"),
        ticketDue: true,
      })
    })
  })
  describe("estimate due dates", () => {
    it("estimated date info created before delta should be claimable next epoch", () => {
      
      const actualResult = estimateTicketDateInfo(
        currentEpoch,
        1655201767918,
        18000
      )

      expect(actualResult).toEqual({
        ticketDueDate: new Date("2022-06-17T00:34:24.373Z"),
        ticketDue: false,
      })
    })
    it("estimated date info created within delta should be claimable next epoch + 1", () => {
     
      const actualResult = estimateTicketDateInfo(
        currentEpoch,
        1655201767918,
        25000
      )

      expect(actualResult).toEqual({
        ticketDueDate: new Date("2022-06-20T16:32:00.373Z"),
        ticketDue: false,
      })
    })
  })
})

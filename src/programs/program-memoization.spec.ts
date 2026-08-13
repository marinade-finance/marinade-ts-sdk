import { web3 } from '@coral-xyz/anchor'

import { Marinade } from '../marinade'
import { MarinadeConfig } from '../config/marinade-config'

// Constructing an anchor Program rebuilds the entire IDL coder (thousands of
// camelCase -> toLocaleUpperCase calls). Hot paths such as
// getValidatorRecords/getStakeRecords read the `program` getter once per
// decoded record, and on WebKit — which re-parses the ICU locale on every
// toLocaleUpperCase call — an un-memoized getter froze consumers' main thread
// for ~10s per call site (marinade-web GEN-8698).
describe('anchor Program getter memoization', () => {
  const marinade = new Marinade(
    new MarinadeConfig({
      connection: new web3.Connection('http://localhost:8899'),
    })
  )

  it('marinadeFinanceProgram.program returns the same instance', () => {
    const { marinadeFinanceProgram } = marinade
    expect(marinadeFinanceProgram.program).toBe(marinadeFinanceProgram.program)
  })

  it('marinadeReferralProgram.program returns the same instance', () => {
    const { marinadeReferralProgram } = marinade
    expect(marinadeReferralProgram.program).toBe(
      marinadeReferralProgram.program
    )
  })
})

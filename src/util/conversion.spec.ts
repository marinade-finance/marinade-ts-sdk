import { BN } from '@project-serum/anchor'

const SOL_DECIMALS = 9

export function withDecimalPoint(bn: BN, decimals: number): string {
  const s = bn.toString().padStart(decimals + 1, '0')
  const l = s.length
  return s.slice(0, l - decimals) + '.' + s.slice(-decimals)
}

export function tokenBalanceToNumber(bn: BN, decimals: number): number {
  return Number(withDecimalPoint(bn, decimals))
}

export function lamportsToSol(bn: BN): number {
  return tokenBalanceToNumber(bn, SOL_DECIMALS)
}

export function solToLamports(amountSol: number): BN {
  return new BN(amountSol.toFixed(SOL_DECIMALS).replace('.', ''))
}

describe('conversion', () => {
  describe('withDecimalPoint', () => {
    [
      { bn: 0, decimals: 4, expectedResult: '0.0000' },
      { bn: 30, decimals: 4, expectedResult: '0.0030' },
      { bn: 3141592, decimals: 6, expectedResult: '3.141592' },
    ].forEach(({ bn, decimals, expectedResult }) =>
      it(`converts ${bn} with ${decimals} decimals to ${expectedResult}`, () => {
        const actualResult = withDecimalPoint(new BN(bn), decimals)

        expect(actualResult).toBe(expectedResult)
      })
    )
  })

  describe('tokenBalanceToNumber', () => {
    [
      { bn: 1, decimals: 6, expectedResult: 1e-6 },
      { bn: 1000000, decimals: 6, expectedResult: 1 },
      { bn: 1000001, decimals: 6, expectedResult: 1.000001 },
    ].forEach(({ bn, decimals, expectedResult }) =>
      it(`converts ${bn} with ${decimals} decimals to ${expectedResult}`, () => {
        const actualResult = tokenBalanceToNumber(new BN(bn), decimals)

        expect(actualResult).toBe(expectedResult)
      })
    )
  })

  describe('lamportsToSol', () => {
    it('converts the value correctly', () => {
      const actualResult = lamportsToSol(new BN('331727544677'))
      expect(actualResult).toBe(331.727544677)
    })
  })

  describe('solToLamports', () => {
    [
      { amountSol: 0, expectedResult: new BN(0) },
      { amountSol: 0.1, expectedResult: new BN(1e8) },
      { amountSol: 1000.123456789, expectedResult: new BN('1000123456789') },
      { amountSol: 10.123456789012, expectedResult: new BN('10123456789') },
    ].forEach(({ amountSol, expectedResult }) =>
      it(`converts ${amountSol} to ${expectedResult.toString()} lamports`, () => {
        const actualResult = solToLamports(amountSol)

        expect(actualResult.toString()).toBe(expectedResult.toString())
      })
    )
  })
})

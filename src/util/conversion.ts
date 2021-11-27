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

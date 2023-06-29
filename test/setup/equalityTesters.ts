import { expect } from '@jest/globals'
import { PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

/**
 * Equality testers for jest to compare BN and PublicKey.
 */
expect.addEqualityTesters([
  (a, b) => {
    if (a instanceof BN) {
      return a.eq(b as BN)
    }
    return undefined
  },
  (a, b) => {
    if (a instanceof PublicKey) {
      return a.equals(b as PublicKey)
    }
    return undefined
  },
])

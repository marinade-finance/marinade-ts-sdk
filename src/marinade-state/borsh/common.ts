import { PublicKey } from '@solana/web3.js'

export function deserializePublicKey({ publicKey }: { publicKey: Buffer }) {
  return new PublicKey(publicKey)
}

export function deserializeF64({ bytes }: { bytes: Buffer }): {
  value: number
} {
  const buffer = new ArrayBuffer(8)
  const view = new DataView(buffer)
  const bytesArray = [...new Uint8Array(bytes)]
  bytesArray.forEach((byte, index) => {
    view.setUint8(index, byte)
  })

  return { value: new DataView(buffer).getFloat64(0, true) }
}

export const commonBorshSchema = [
  [
    deserializePublicKey,
    {
      kind: 'struct',
      fields: [['publicKey', [32]]],
    },
  ],
  [
    deserializeF64,
    {
      kind: 'struct',
      fields: [['bytes', [8]]],
    },
  ],
] as const

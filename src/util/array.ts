export const bounds = (index: number, itemSize: number, offset = 0): [number, number] => [
  offset + index * itemSize,
  offset + (index + 1) * itemSize,
]

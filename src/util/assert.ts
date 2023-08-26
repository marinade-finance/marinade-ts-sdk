import { PublicKey } from '@solana/web3.js'

export function assertNotNull<T>(
  arg: T,
  err = 'Asserted value is null!'
): asserts arg is Exclude<T, null> {
  if (arg === null) {
    throw new Error(err)
  }
}

export function assertNotUndefined<T>(
  arg: T,
  err = 'Asserted value is undefined!'
): asserts arg is Exclude<T, undefined> {
  if (arg === undefined) {
    throw new Error(err)
  }
}

export function assertNotDefault(
  arg: PublicKey,
  err = 'Asserted value is default PublicKey!'
) {
  if (arg.equals(PublicKey.default)) {
    throw new Error(err)
  }
}

export function assertNotNullAndReturn<T>(
  arg: T,
  err = 'Asserted value is null!'
): Exclude<T, null> {
  assertNotNull(arg, err)
  return arg
}

export function assertNotUndefinedAndReturn<T>(
  arg: T,
  err = 'Asserted value is undefined!'
): Exclude<T, undefined> {
  assertNotUndefined(arg, err)
  return arg
}

const assertNotNull: <T>(
  arg: T,
  err?: string
) => asserts arg is Exclude<T, null> = (
  arg,
  err = 'Asserted value is null!'
) => {
  if (arg === null) {
    throw new Error(err)
  }
}

export const assertNotNullAndReturn = <T>(
  arg: T,
  err = 'Asserted value is null!'
): Exclude<T, null> => {
  assertNotNull(arg, err)
  return arg
}

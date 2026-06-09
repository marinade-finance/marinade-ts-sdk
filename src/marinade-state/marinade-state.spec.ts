import { Marinade, MarinadeState, MarinadeUtils, web3 } from '..'

describe('MarinadeState.canonicalStakeAddress', () => {
  const marinadeStateAddress = new web3.PublicKey(
    '8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC'
  )
  const marinadeFinanceProgramId = new web3.PublicKey(
    'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'
  )
  const validatorVoteAddress = new web3.PublicKey(
    '26FuvLwZvqGNknUoDnvGL4yUE9563KtfHcR42AqxFK6Z'
  )

  it('derives the PDA from seeds [state, validator, "canonical_stake"]', () => {
    const [expected] = web3.PublicKey.findProgramAddressSync(
      [
        marinadeStateAddress.toBuffer(),
        validatorVoteAddress.toBuffer(),
        Buffer.from('canonical_stake'),
      ],
      marinadeFinanceProgramId
    )
    expect(
      MarinadeState.canonicalStakeAddress(
        marinadeStateAddress,
        validatorVoteAddress,
        marinadeFinanceProgramId
      ).equals(expected)
    ).toBe(true)
  })

  it('derives a locked, known address for fixed inputs', () => {
    // Guard constant for the mainnet state + a fixture validator vote account.
    // Cross-check against the program's State::find_canonical_stake_address.
    expect(
      MarinadeState.canonicalStakeAddress(
        marinadeStateAddress,
        validatorVoteAddress,
        marinadeFinanceProgramId
      ).toBase58()
    ).toBe('7kX5vBqfP3r1ZQQ2tjz3x1nL3yFt517Tq1QQvBA2nkng')
  })
})

describe('MarinadeState', () => {
  it('getStakeStates', async () => {
    const marinade = new Marinade()
    const state = await marinade.getMarinadeState()

    const accountInfos: {
      pubkey: web3.PublicKey
      account: web3.AccountInfo<Buffer>
    }[] = [
      {
        account: {
          data: Buffer.from(
            'AgAAAIDVIgAAAAAANW0aj6LBKPbJQ/wTWTSoQgM4pWWci256Ye2TQjl8FVuAaQtLGkbornYeejJYw3kxRYbab8LmYo3X4irqaL1q7AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEClM1NCYixYJ/F511x003U5jAB5HWc+6vGBUWA4WISTCwRyggAAAACTAAAAAAAAAP//////////AAAAAAAA0D/YExAEAAAAAAAAAAA=',
            'base64'
          ),
          executable: false,
          lamports: 2190793099,
          owner: MarinadeUtils.STAKE_PROGRAM_ID,
          rentEpoch: 224,
        },
        pubkey: new web3.PublicKey(
          '6yWLeYR8RsBHGbAvUGQhsi72JEhn2sZAjY2jxjQPT5sC'
        ),
      },
    ]

    marinade.provider.connection.getProgramAccounts = jest
      .fn()
      .mockResolvedValueOnce(accountInfos)

    const stakeStates = await state.getStakeStates()

    expect(stakeStates).toMatchSnapshot()
  })
})

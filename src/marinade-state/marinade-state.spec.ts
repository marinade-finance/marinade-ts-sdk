import {  Marinade, MarinadeUtils, web3 } from '..'

describe('MarinadeState', () => {
  it('getStakeStates', async() => {
    const marinade = new Marinade()
    const state = await marinade.getMarinadeState()

    const accountInfos: {
      pubkey: web3.PublicKey
      account: web3.AccountInfo<Buffer>
    }[] = [{
      account: {
        data: Buffer.from('AgAAAIDVIgAAAAAANW0aj6LBKPbJQ/wTWTSoQgM4pWWci256Ye2TQjl8FVuAaQtLGkbornYeejJYw3kxRYbab8LmYo3X4irqaL1q7AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEClM1NCYixYJ/F511x003U5jAB5HWc+6vGBUWA4WISTCwRyggAAAACTAAAAAAAAAP//////////AAAAAAAA0D/YExAEAAAAAAAAAAA=', 'base64'),
        executable: false,
        lamports: 2190793099,
        owner: MarinadeUtils.STAKE_PROGRAM_ID,
        rentEpoch: 224,
      },
      pubkey: new web3.PublicKey('6yWLeYR8RsBHGbAvUGQhsi72JEhn2sZAjY2jxjQPT5sC'),
    }]

    marinade.anchorProvider.connection.getProgramAccounts = jest.fn().mockResolvedValueOnce(accountInfos)

    const stakeStates = await state.getStakeStates()

    expect(stakeStates).toMatchSnapshot()
  })
})

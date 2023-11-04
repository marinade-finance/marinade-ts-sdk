import {
  AccountInfo,
  Connection,
  Keypair,
  PublicKey,
  StakeProgram,
} from '@solana/web3.js'
import { DEFAULT_PROVIDER_URL, fetchMarinadeState, getStakeStates } from '..'
import { marinadeFinanceProgram } from '../programs/marinade-finance-program'
import { AnchorProvider } from '@coral-xyz/anchor'
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'

describe('MarinadeState', () => {
  it('getStakeStates', async () => {
    const provider = new AnchorProvider(
      new Connection(DEFAULT_PROVIDER_URL),
      new NodeWallet(Keypair.generate()),
      { commitment: 'confirmed' }
    )
    const marinadeProgram = marinadeFinanceProgram({ provider })
    const marinade = await fetchMarinadeState(marinadeProgram)

    const accountInfos: {
      pubkey: PublicKey
      account: AccountInfo<Buffer>
    }[] = [
      {
        account: {
          data: Buffer.from(
            'AgAAAIDVIgAAAAAANW0aj6LBKPbJQ/wTWTSoQgM4pWWci256Ye2TQjl8FVuAaQtLGkbornYeejJYw3kxRYbab8LmYo3X4irqaL1q7AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEClM1NCYixYJ/F511x003U5jAB5HWc+6vGBUWA4WISTCwRyggAAAACTAAAAAAAAAP//////////AAAAAAAA0D/YExAEAAAAAAAAAAA=',
            'base64'
          ),
          executable: false,
          lamports: 2190793099,
          owner: StakeProgram.programId,
          rentEpoch: 224,
        },
        pubkey: new PublicKey('6yWLeYR8RsBHGbAvUGQhsi72JEhn2sZAjY2jxjQPT5sC'),
      },
    ]

    provider.connection.getProgramAccounts = jest
      .fn()
      .mockResolvedValueOnce(accountInfos)

    const stakeStates = await getStakeStates(provider.connection, marinade)

    expect(stakeStates).toMatchSnapshot()
  })
})

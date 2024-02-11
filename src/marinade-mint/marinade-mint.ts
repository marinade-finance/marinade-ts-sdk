import { getMint, Mint } from '@solana/spl-token'
import { tokenBalanceToNumber } from '../util/conversion'
import { Connection, PublicKey } from '@solana/web3.js'
import BN from 'bn.js'

export class MarinadeMint {
  private constructor(
    private readonly connection: Connection,
    public readonly address: PublicKey
  ) {}

  static build(connection: Connection, mintAddress: PublicKey): MarinadeMint {
    return new MarinadeMint(connection, mintAddress)
  }

  mintInfo = (): Promise<Mint> => getMint(this.connection, this.address)

  /**
   * Returns Total supply as a number with decimals
   * @param mintInfoCached optional
   * @returns
   */
  async totalSupply(mintInfoCached?: Mint): Promise<number> {
    const mintInfo = mintInfoCached ?? (await this.mintInfo())
    return tokenBalanceToNumber(
      new BN(mintInfo.supply.toString()),
      mintInfo.decimals
    )
  }
}

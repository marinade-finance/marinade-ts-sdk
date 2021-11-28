# <p align="center"><a href="https://marinade.finance/"><img src="https://raw.githubusercontent.com/marinade-finance/liquid-staking-program/main/Docs/img/MNDE.png" height="100" alt="Marinade"></a>

# marinade-ts-sdk

Marinade.finance is a liquid staking protocol built on Solana. People stake their Solana tokens with Marinade using automatic staking strategies and receive "staked SOL" tokens they can use in the world of DeFi or to swap any time back to original SOL tokens to unstake.

This SDK wraps the staking protocol and allows you to start marinading from your applications.

![Build](https://github.com/marinade-finance/marinade-ts-sdk/actions/workflows/build-test.yml/badge.svg)

Contents:
- [Installation](#installation)
- [Examples](#examples)
   - [Initialize the library](#initialize-the-library)
   - [Staking](#staking)
   - [Liquidity pool](#liquidity-pool)
- [Learn more](#learn-more)

## Installation
```bash
$ npm run install @marinade.finance/marinade-ts-sdk
```

## Examples

### Initialize the library

1) Use the default configuration (with Solana devnet):
```ts
import { Marinade } from '@marinade.finance/marinade-ts-sdk'

const marinade = new Marinade()
```

2) Extend your configuration with other options:
```ts
import { Marinade, MarinadeConfig, Wallet } from '@marinade.finance/marinade-ts-sdk'

const config = new MarinadeConfig({
  anchorProviderUrl: 'https://api.mainnet-beta.solana.com',
  wallet: Wallet.local().payer,
})
const marinade = new Marinade()
```

3) Use environment variables to set the configuration values:

| Environment variable      | Default value                                    |
| ------------------------- | ------------------------------------------------ |
| `MARINADE_PROGRAM_ID`     | `'MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD'`  |
| `MARINADE_STATE_ADDRESS`  | `'8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC'` |
| `STAKE_WITHDRAW_AUTH_PDA` | `'9eG63CdHjsfhHmobHgLtESGC8GabbmRcaSpHAZrtmhco'` |
| `ANCHOR_PROVIDER_URL`     | `'https://api.devnet.solana.com'`                |

### Staking

Stake SOL and get your mSOL:
```ts
...
const {
  associatedMSolTokenAccountAddress,
  transactionSignature,
} = await marinade.deposit(amountLamports)
```

Swap your mSOL to get back SOL immediately using the liquidity pool:
```ts
...
const {
  associatedMSolTokenAccountAddress,
  transactionSignature,
} = await marinade.liquidUnstake(amountLamports)
```

### Liquidity pool

Add liquidity to the liquidity pool and receive LP tokens:
```ts
...
const {
  associatedLPTokenAccountAddress,
  transactionSignature,
} = await marinade.addLiquidity(amountLamports)
```

Burn LP tokens and get SOL and mSOL back from the liquidity pool:
```ts
...
const {
  associatedLPTokenAccountAddress,
  associatedMSolTokenAccountAddress,
  transactionSignature,
} = await marinade.removeLiquidity(amountLamports)
```

For more examples have a look at [Marinade TS CLI](https://github.com/marinade-finance/marinade-ts-cli)

## Learn more
- [Marinade web](https://marinade.finance)
- [Marinade docs](https://docs.marinade.finance/)
- [Join on Discord](https://discord.com/invite/6EtUf4Euu6)

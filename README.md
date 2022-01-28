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
or using plain HTML (do not forget to replace `<VERSION>`):
```html
<script src='https://github.com/marinade-finance/marinade-ts-sdk/releases/download/<VERSION>/marinade-ts-sdk.min.js'></script>
<script>
  const { Marinade } = MarinadeSdk
  const marinade = new Marinade()
</script>
```

2) Extend your configuration with other options:
```ts
import { Marinade, MarinadeConfig, Wallet, Provider } from '@marinade.finance/marinade-ts-sdk'

const config = new MarinadeConfig({
  connection: currentConnection,
  pubkey: wallet.pubKey
})
const marinade = new Marinade(config)
```

3) When you use the `referral code`, staking/unstaking functions are run against the [Marinade Referral Program](https://github.com/marinade-finance/liquid-staking-referral-program).
```ts
import { Marinade, MarinadeConfig } from '@marinade.finance/marinade-ts-sdk'

const MY_REFERRAL_ACCOUNT = "...." // <-- your referral account
const config = new MarinadeConfig({
  connection: currentConnection,
  pubkey: wallet.pubKey,
  referralCode: new web3.PublicKey(MY_REFERRAL_ACCOUNT),
})
const marinade = new Marinade(config)
```

### Staking

Stake SOL and get your mSOL:
```ts
...
const {
  associatedMSolTokenAccountAddress,
  transaction,
} = await marinade.deposit(amountLamports)
// sign and send the `transaction`
const signature = await provider.send(transaction)
```

Swap your mSOL to get back SOL immediately using the liquidity pool:
```ts
...
const {
  associatedMSolTokenAccountAddress,
  transaction,
} = await marinade.liquidUnstake(amountLamports)
// sign and send the `transaction`
const signature = await provider.send(transaction)
```

### Liquidity pool

Add liquidity to the liquidity pool and receive LP tokens:
```ts
...
const {
  associatedLPTokenAccountAddress,
  transaction,
} = await marinade.addLiquidity(amountLamports)
// sign and send the `transaction`
const signature = await provider.send(transaction)
```

Burn LP tokens and get SOL and mSOL back from the liquidity pool:
```ts
...
const {
  associatedLPTokenAccountAddress,
  associatedMSolTokenAccountAddress,
  transaction,
} = await marinade.removeLiquidity(amountLamports)
// sign and send the `transaction`
const signature = await provider.send(transaction)
```

For more examples have a look at [Marinade TS CLI](https://github.com/marinade-finance/marinade-ts-cli)

## Learn more
- [Marinade web](https://marinade.finance)
- [Marinade docs](https://docs.marinade.finance/)
- [Join on Discord](https://discord.com/invite/6EtUf4Euu6)

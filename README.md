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
$ npm install @marinade.finance/marinade-ts-sdk
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
  publicKey: wallet.pubKey
})
const marinade = new Marinade(config)
```

3) When you use the `referral code`, staking/unstaking functions are run against the [Marinade Referral Program](https://github.com/marinade-finance/liquid-staking-referral-program).
```ts
import { Marinade, MarinadeConfig } from '@marinade.finance/marinade-ts-sdk'

const MY_REFERRAL_ACCOUNT = "...." // <-- your referral account
const config = new MarinadeConfig({
  connection: currentConnection,
  publicKey: wallet.pubKey,
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

### Marinade Native Staking

You can now stake assets in Marinade Native through the SDK, either with or without a referral code.

#### Stake without referral code
If you choose to stake without a referral code, the methods exposed in `marinade-native-stake.ts` serve as wrappers for those already detailed in the [Native Stake SDK](https://www.npmjs.com/package/@marinade.finance/native-staking-sdk).
Please note that staking without a referral code will yield only Transaction Instructions.

#### Stake with referral code
To acquire a referral code, you'll need to visit the [Marinade dApp](https://marinade.finance/app/earn/) to retrieve it.
Once you have the code, you can input it into the methods described below. Please note that the method returns a Versioned Transaction.

Stake SOL to Marinade Native
```ts
...
const versionedTransaction = await getRefNativeStakeSOLTx(userPublicKey, amountLamports, refCode)
// sign and send the `transaction`
const signature = await wallet.sendTransaction(unsignedTx, connection)
```

Deposit Stake Account to Marinade Native
```ts
...
const versionedTransaction = await getRefNativeStakeAccountTx(userPublicKey, stakeAccountAddress, refCode)
// sign and send the `transaction`
const signature = await wallet.sendTransaction(versionedTransaction, connection)
```

#### Prepare for Unstake from Marinade Native
To initiate the process of unstaking, you'll need to merge your stake accounts back into a single account and pay the associated fee (in SOL). To do this, execute the following command:

```ts
...
const transaction = new Transaction()
const prepareUnstakeIx = await getPrepareNativeUnstakeSOLIx(userPublicKey, amountLamports)
transaction.add(...prepareUnstakeIx.payFees)
// sign and send the `transaction`
const signature = await wallet.sendTransaction(transaction, connection)
await authIx.onPaid()
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

## Marinade Lookup Table
Marinade lookup table address: [`DCcQeBaCiYsEsjjmEsSYPCr9o4n174LKqXNDvQT5wVd8`](https://solscan.io/account/DCcQeBaCiYsEsjjmEsSYPCr9o4n174LKqXNDvQT5wVd8#tableEntries)
```bash
solana address-lookup-table --keypair ...
solana address-lookup-table extend --keypair ... DCcQeBaCiYsEsjjmEsSYPCr9o4n174LKqXNDvQT5wVd8 --addresses \
11111111111111111111111111111111,\
TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA,\
SysvarC1ock11111111111111111111111111111111,\
SysvarRent111111111111111111111111111111111,\
Stake11111111111111111111111111111111111111,\
MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD,\
8szGkuLTAux9XMgZ2vtY39jVSowEcpBfFfD8hXSEqdGC,\
mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So,\
UefNb6z6yvArqe4cJHTXCqStRsKmWhGxnZzuHbikP5Q,\
7GgPYjS5Dza89wV6FpZ23kUJRG5vbQ1GM25ezspYFSoE,\
EyaSjUtSgo9aRD1f8LWXwdvkpDTmXAW54yoSHZRF14WL,\
Du3Ysj1wKbxPKkuPPnvzQLQh8oMSVifs3jGZjJWXFmHN,\
3JLPCS1qM2zRw3Dp6V4hZnYHd4toMNPkNesXdX9tg6KM,\
Anv3XE7e5saNdm16MU6bniYS59Mpv7DzQXHAhxJUmAKW,\
DwFYJNnhLmw19FBTrVaLWZ8SZJpxdPoSYVSJaio9tjbY,\
J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn,\
Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb
```
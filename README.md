# <p align="center"><a href="https://marinade.finance/"><img src="https://raw.githubusercontent.com/marinade-finance/liquid-staking-program/main/Docs/img/MNDE.png" height="100" alt="Marinade"></a>

# marinade-ts-sdk

Marinade.finance is a liquid staking protocol built on Solana. People stake their Solana tokens with Marinade using automatic staking strategies and receive "staked SOL" tokens they can use in the world of DeFi or to swap any time back to original SOL tokens to unstake.

This SDK wraps the staking protocol and allows you to start marinading from your applications.

![Build](https://github.com/marinade-finance/marinade-ts-sdk/actions/workflows/build-test.yml/badge.svg)
<a href="https://www.npmjs.com/package/@marinade.finance/marinade-ts-sdk"><img src="https://img.shields.io/npm/v/%40marinade.finance%2Fmarinade-ts-sdk?logo=npm&color=377CC0" /></a>

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

## Depositing stake accounts

The liquid staking program requires a deposited stake account to satisfy
`lamports == delegation.stake + meta.rent_exempt_reserve`.

The [SIMD-0437](https://github.com/solana-foundation/solana-improvement-documents/blob/main/proposals/0437-incremental-rent-reduction.md)
rent reduction lowered the rent, while the stake program keeps freezing `meta.rent_exempt_reserve`
of every new account at the pre-reduction `2_282_880` lamports. Every stake account delegated or
split after the reduction therefore holds less than the program expects, and the deposit is
rejected with `WrongStakeBalance` (6048).

The SDK deposit methods handle it. They align the stake account balance with a plain SOL transfer
before the deposit instruction. Build the `deposit_stake_account` instruction yourself and you have
to do the same:

```ts
const stakeAccountInfo = await MarinadeUtils.getParsedStakeAccountInfo(
  connection,
  stakeAccountAddress
)
const rent = await connection.getMinimumBalanceForRentExemption(
  web3.StakeProgram.space
)
const { epoch } = await connection.getEpochInfo()

instructions.push(
  ...MarinadeUtils.stakeAccountBalanceAlignmentInstructions(
    stakeAccountInfo,
    ownerAddress,
    epoch,
    rent
  ),
  depositStakeAccountInstruction
)
```

Append the returned instructions **after** any `StakeProgram.delegate` of your own. A cooled-down
account is re-delegated first, and the top-up is derived from what re-delegation restakes. The
`rent` argument must be the live `getMinimumBalanceForRentExemption(web3.StakeProgram.space)`.

A stake account created within the same transaction cannot be read yet, so pass the lamports that
will stay non-delegated to `MarinadeUtils.newStakeAccountBalanceAlignmentInstructions` instead —
the pre-funding of a stake pool split destination, or the live rent when your own
`StakeProgram.delegate` restakes everything above it:

```ts
const alignment = MarinadeUtils.newStakeAccountBalanceAlignmentInstructions(
  stakeAccountAddress,
  ownerAddress,
  await connection.getMinimumBalanceForRentExemption(web3.StakeProgram.space)
)
```

For such a freshly delegated account the gap is
`2_282_880 - getMinimumBalanceForRentExemption(web3.StakeProgram.space)` — 205,656 lamports at
SIMD-0437 step 1, 2,054,592 at the final step. That formula holds only for a new account. An
existing one goes through `stakeAccountBalanceAlignmentInstructions`, which reads
`meta.rentExemptReserve` against the current balance and often returns nothing at all. Never
hardcode either value. The topped-up lamports stay in the stake account as non-delegated balance
and no mSOL is minted for them.

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
Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb,\
Bcr3rbZq1g7FsPz8tawDzT6fCzN1pvADthcv3CtTpd3b,\
MariuAU5bpAbmyX21J2igSHTRF3Ah4GyERRfDBwrPYo,\
D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf,\
9Ed78GzZrHN61XH9CkcMHFrkSMD88sPWVJCvjres46cT,\
GWvyD94pBVHqV7swFG6ASwD8BHeyeumonQ1yv6qEt3ce,\
CnUPHtfUVw3D2s4FB8H6QBuLwoes8YxauVgDtFybm7rz,\
dsNNp4g7NUv4u7GA8GqfMPCCPPxYdHk8vypbp2fbkiC,\
A8kEy5wWgdW4FG593fQJ5QPVbqx1wkfXw9c4L9bPo2CN,\
9nnLbotNTcUhvbrsA6Mdkx45Sm82G35zo28AqUvjExn8,\
So11111111111111111111111111111111111111112,\
AGcY7eBWGuLJVWc8HdamDZHBPQCn8K4ydB8pafEkcQz3,\
GkSKNXhfvhqpCrF2BqjMKoaczRXQSc8pVJai7qkmhx9V,\
JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4,\
FhLPkpFmszHtSyyayj7KsXNZeBTqfQbUPmvgWAyJHBXh,\
HxTk98CmBcxmtkrBWqRszYxrnDpqAsbitQBc2QjVBG3j,\
Dy1zNe9eqoTtVBjUbkunuJ8fFbHsMBdMxFemerFWAsKy,\
HtncvpUBGhSrs48KtC58ntJcTDw53sn78Lpq71zVwiez,\
GN3KFotCLCme8na7CTdCR9Wy6CTxHmjmHvXaLnNRKabZ,\
4VKKMz4XCyHkRYy86tGRF9ninmwVCHdxdk3dRjY3WGxc
```

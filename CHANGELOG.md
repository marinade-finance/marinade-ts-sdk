## v5.0.8

### Fix:

    - Update directed stake sdk and method call
    - Add warning about low liquidity on unstake via our pool

## v5.0.7

### Feat:

    - Add method to support delayed unstake with PublicKey instead of Keypair

## v5.0.6

### Feat:

    - IDL update coming with upgrade of liquid-staking-program contract

## v5.0.5

### Feat:

    - Add support to stake into Marinade Native with or without Referral Code
    - Add support to unstake from Marinade Native

## v5.0.4

### Fix:

    - Make it possible to stake locked stake accounts that have the lock period in the past

## v5.0.3

### Feat:

    - Add beta support to (partially) deposit activating stake accounts via `depositActivatingStakeAccount`
    - Make `createDirectedStakeVoteIx` public so it can be used in various transactions (like when swapping LSTs via Jup)
    - Add setup to run integration tests on local validator within the pipeline
    - Add beta support to partially deposit stake accounts via `partiallyDepositStakeAccount`
    - Add beta support to partially liquidate stake accounts via `partiallyLiquidateStakeAccount`

## v5.0.2

### Fix: 

    - Update missing refactor change for `addLiquidity` that would cause this method to be unusable

## v5.0.1

### Feat:

    - Created Marinade Address lookup table at `DCcQeBaCiYsEsjjmEsSYPCr9o4n174LKqXNDvQT5wVd8`
    - Add beta support to deposit Stake Pool Tokens to mSOL via `depositStakePoolToken`
    - Add beta support to liquidate Stake Pool Tokens via `liquidateStakePoolToken`
    - Add delayed unstake support in SDK via `orderUnstake`
    - Add claim tickets support in SDK via `claim`
    - Add support to retrieve user Directed stake vote via `getUsersVoteRecord`

### Chore:

    - More house work on improving the codebase
    - Migrate to `pnpm`

## v5.0.0

### Feat:

    - Add support for Directed stake on all stake methods (both from SOL and stake accounts)
    - Add support to deposit deactivating stake accounts via `depositStakeAccountByAccount`
    - Add same contract checks in the SDK for stake accounts on `depositStakeAccountByAccount`

### Chore:

    - House work on using dependencies and IDLs

## v4.0.6

### Fix:

    - Adjust `liquidateStakeAccount` to use the right amounts

### Chore:

    - Small house work on descriptions/methods

## v4.0.5

### Fix:

    - Claim extra lamports when staking/liquidating stake accounts (most common case: these stake accounts have extra lamports from MEV rewards)

### Chore:

    - Update `spl-token` library and refactor code accordingly

## v4.0.3

### Feat:

    - Add support to retrieve all referral partners

## v4.0.2

Fix incorrect mSOL amount calculation in function `liquidateStakeAccount`, when using a referral code

## v4.0.1

Fix incorrect mSOL amount calculation in function `liquidateStakeAccount`, when using a referral code

## v4.0.0

Uses Referral-Program V2

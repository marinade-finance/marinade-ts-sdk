# Development notes

The Marinade TS SDK provides a facade on functionality of the three contract programs.

* [liquid-staking-program](https://github.com/marinade-finance/liquid-staking-program)
* [liquid-staking-referral-program](https://github.com/marinade-finance/liquid-staking-referral-program)
* [directed-stake](https://github.com/marinade-finance/directed-stake)

See expected program ids and global states of the programs at
[`marinade-config.ts`](./src/config/marinade-config.ts).

## Testing

The tests consist of two parts - unit tests and integration tests.

### Unit testing

Unit tests are executed with `pnpm test` and requires connection to Solana devnet.
They are fast and verifies mostly only on account structure.

The unit tests are located at `./src/**/*.spec.ts`.

### Integration testing

Integration tests are executed with `pnpm test:integration`.
They require installation of
[solana tool suite](https://docs.solana.com/cli/install-solana-cli-tools) and [anchor cli](https://www.anchor-lang.com/docs/installation)
at localhost.

The `solana-test-validator` is launched through `anchor` CLI tooling at the start of test execution.
Anchor of version `0.28.0` or higher is required.

The `solana-test-validator` is configured via [`Anchor.toml`](./Anchor.toml) where contract programs are loaded from `.so`
files from [`fixtures/programs`](./fixtures/programs/).
In the same way there are defined accounts loaded at the `solana-test-validator` start-up.

**NOTE:** the `solana-test-validator` command startup arguments can be verified at `.anchor/test-ledger/validator.log`
          after integration tests are started

For integration tests running at the Github actions there is created a Docker image
specified by docker file at [`.github/docker`](./.github/docker/Dockerfile) that setup the solana and Anchor
that is then used by the actions
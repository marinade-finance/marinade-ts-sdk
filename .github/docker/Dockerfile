FROM ubuntu:latest AS builder

RUN apt-get update && \
    apt-get install -y curl cargo pkg-config build-essential libudev-dev

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- --default-toolchain none -y

ENV PATH="${PATH}:/root/.cargo/bin"

RUN rustup toolchain install nightly --allow-downgrade --profile minimal --component clippy && \
    rustup install nightly && \
    rustup default nightly && \
    rustup toolchain list

RUN sh -c "$(curl -sSfL https://release.solana.com/v1.14.18/install)"

RUN cargo install --git https://github.com/project-serum/anchor avm --locked --force && \
    avm install 0.28.0 && \
    avm use 0.28.0

RUN  /root/.local/share/solana/install/active_release/bin/solana-keygen new --no-bip39-passphrase && \
     /root/.local/share/solana/install/active_release/bin/solana config set --url http:localhost:8899



FROM ubuntu:latest AS final

RUN apt-get update && \
    apt-get install -y bzip2

# solana configuration
COPY --from=builder /root/.avm/ /root/.avm
COPY --from=builder /root/.config/solana/ /root/.config/solana
# solana binaries
COPY --from=builder /root/.cargo/bin/avm /root/.cargo/bin/anchor /root/.cargo/bin/
COPY --from=builder /root/.local/share/solana/install/active_release/bin/solana-test-validator /root/.local/share/solana/install/active_release/bin/solana /root/.local/share/solana/install/active_release/bin/

# Workaround for Github actions and avm.
# We need to `ln` the `.avm` directory to github actions $HOME directory.
# There is an issue that `avm` requires the `~/.avm` to exist
# while github actions limits what is the home directory, see https://github.com/actions/runner/issues/863
RUN chmod uog+rwx -R /root/.avm
RUN chmod uog+rwx -R /root/.config/solana

ENV PATH="${PATH}:/root/.cargo/bin:/root/.avm/bin:/root/.local/share/solana/install/active_release/bin"

ENV HOME=/root
USER root

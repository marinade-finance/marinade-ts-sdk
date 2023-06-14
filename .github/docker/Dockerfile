FROM ubuntu:latest

RUN apt-get update
RUN apt-get install -y curl cargo pkg-config build-essential libudev-dev

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- --default-toolchain none -y

# RUN echo 'source $HOME/.cargo/env' >> ~/.bashrc

ENV PATH="${PATH}:/root/.cargo/bin"

RUN rustup toolchain install nightly --allow-downgrade --profile minimal --component clippy && \
    rustup install nightly && \
    rustup default nightly && \
    rustup toolchain list

RUN sh -c "$(curl -sSfL https://release.solana.com/v1.14.18/install)"

RUN cargo install --git https://github.com/project-serum/anchor avm --locked --force
RUN avm install 0.28.0

ENV PATH="${PATH}:/root/.avm/bin:/root/.local/share/solana/install/active_release/bin"

# being possible to ln .avm to $HOME defined by github actions
# workaround to how Anchor works - it requires the $HOME directory have the .avm
#   and to limitation of https://github.com/actions/runner/issues/863
RUN chmod uog+rwx -R /root/.avm

ENV HOME=/root
USER root

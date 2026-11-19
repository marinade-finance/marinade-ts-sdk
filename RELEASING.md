# Releasing

A release needs a YubiKey twice. Each step is checked by a different system:

```
git tag -s v6.2.0          release.yml (GitHub Actions)                       npmjs.com
YubiKey: touch + PIN  ──►  verify-tag ─► build ─► stage ──► staged, not public ──► Approve
                           sig, signer,  pnpm     npm stage                          YubiKey
                           main, version pack     publish (OIDC)                     (npm 2FA)
```

1. **Signed tag, checked by CI.** The tag must be signed with a FIDO2 SSH key listed in
   [`.github/release-signers`](.github/release-signers).
   [`verify-release-tag.mjs`](.github/scripts/verify-release-tag.mjs) checks the
   signature with `ssh-keygen`, then checks that the key is a security key (`sk-*`) and
   that the FIDO flags inside the signature say it was touched and the PIN was entered.
   `git verify-tag` and `ssh-keygen -Y verify` accept sk-key signatures with neither.
   A signature can't prove which device made it, so the signer list must only hold keys
   checked to be on a YubiKey when they were added (see below).
2. **Staged publish, approved on npm.** CI can only *stage* the package (`npm stage publish`
   through npm trusted publishing; no npm token is involved). The version goes public only
   when a maintainer approves it on npm with 2FA. npm enforces this step, so GitHub can't
   bypass it. It needs a YubiKey only if the approver's npm account has no other 2FA
   method (see below).

Why a YubiKey rather than a Ledger: OpenSSH and git support FIDO2 keys natively
(`ed25519-sk`), GitHub shows such signatures as *Verified*, the touch and PIN flags are
part of the signed data, and the same key works as WebAuthn 2FA on npmjs.com.
A Ledger needs a third-party agent (`ledger-agent`) to sign over SSH or GPG.

## One-time setup

### Each release maintainer

Requires a YubiKey 5 (firmware 5.2.3 or later), OpenSSH 8.4 or later and git 2.34 or
later. Apple's bundled `ssh` has no built-in FIDO support: on macOS run
`brew install openssh` and point git at it with
`git config --global gpg.ssh.program "$(brew --prefix)/bin/ssh-keygen"`.

```bash
ykman fido access change-pin          # set a FIDO2 PIN if the key has none
ssh-keygen -t ed25519-sk -O resident -O verify-required \
  -O application=ssh:marinade-release \
  -O write-attestation=$HOME/.ssh/id_ed25519_sk_release.attest \
  -C "release signing key" -f ~/.ssh/id_ed25519_sk_release
```

`-O verify-required` makes every signature need the PIN as well as a touch, and CI
rejects signatures without it. `-O resident` stores the key on the YubiKey, so you can
restore it on another machine with `ssh-keygen -K`. Keep the `.attest` file: it records
the authenticator that created the key.

Configure git in your clone:

```bash
git config gpg.format ssh
git config user.signingkey ~/.ssh/id_ed25519_sk_release.pub
git config gpg.ssh.allowedSignersFile .github/release-signers
```

Then:

- Open a PR that adds one line to `.github/release-signers`, with your GitHub handle as
  the name (the file is public, so don't use an email address) and the first two
  fields of `~/.ssh/id_ed25519_sk_release.pub`:
  `your-github-handle namespaces="git" sk-ssh-ed25519@openssh.com AAAA...`
- The reviewer of that PR checks the key is on your YubiKey, for example on a call:
  with only the YubiKey plugged in, `ssh-keygen -K` (asks for the PIN) restores the
  resident key, and its `.pub` must match the line in the PR.
- Add the same public key to your GitHub account as a **signing key**, so GitHub shows
  your tags as *Verified*.
- On npmjs.com, register the YubiKey (and a spare) as **security keys** for two-factor
  authentication, and remove every other 2FA method from the account: authenticator
  apps and built-in authenticators such as Touch ID or Windows Hello. npm accepts any of
  them for approving a release and has no setting to require a hardware key, so check
  this again whenever the maintainers change. Keep recovery codes offline. You must be a
  maintainer of `@marinade.finance/marinade-ts-sdk`.

### GitHub repository (admin)

- **Environment `npm`** (Settings → Environments): under *Deployment branches and
  tags*, allow only tags matching `v*`, and untick *Allow administrators to bypass
  configured protection rules*. Create it before the release workflow first runs:
  GitHub creates a missing environment without any protection.
- **Two tag rulesets for `v*`**. A ruleset's bypass list both grants creation and
  skips its other rules, so these need separate rulesets:
  - *Restrict creations*, with only the release maintainers on the bypass list.
  - *Restrict updates* and *Restrict deletions*, with an empty bypass list.
- **Branch ruleset for `main`**: require a PR with an approving review. Add a
  `CODEOWNERS` entry for `/.github/` and require Code Owner review. The release workflow
  reads the verifier and the signer list from `main`, so this review protects both.

### npm package (owner)

- *Settings → Trusted Publisher → GitHub Actions*:
  - organization `marinade-finance`
  - repository `marinade-ts-sdk`
  - workflow `release.yml`
  - environment `npm`
  - *Allowed actions*: **stage publish only**. Leave direct `npm publish` disabled.
    npm cannot change an existing trusted publisher, so delete any older one and create
    it again. A new trusted publisher expires unless its first publish succeeds within
    2 days. npm's docs don't say whether a staged publish counts, so set it up shortly
    before a release and approve that release within the 2 days.
- *Settings → Publishing access*: **Require two-factor authentication and disallow
  tokens**.

## Releasing a version

1. Bump `version` in `package.json` and update `CHANGELOG.md` in a PR, then merge it into `main`.
2. Tag the merged commit. Signing asks for your PIN and a touch:

   ```bash
   git checkout main && git pull
   git tag -s v6.2.0 -m v6.2.0
   ```

3. Run the check CI runs before pushing. A pushed `v*` tag can't be moved or deleted,
   so a bad pushed tag means releasing the next version instead:

   ```bash
   node .github/scripts/verify-release-tag.mjs --tag v6.2.0 --signers .github/release-signers --branch origin/main
   ```

4. Push the tag:

   ```bash
   git push origin v6.2.0
   ```

5. When the *Release* workflow is green, open its *stage* job summary. It gives the stage
   ID and the tarball digests. Approve only the stage of the run for the tag you
   pushed, and check that the run's *verify-tag* summary names you as the signer. Then
   download the staged tarball and compare its `sha256sum` with the summary:

   ```bash
   npm stage download <stage-id>
   ```

6. Approve it, either on npmjs.com (package page, **Staged Packages** tab, **Approve**)
   or from the CLI. Either way npm asks for 2FA: touch the YubiKey.

   ```bash
   npm stage approve <stage-id>
   ```

7. Publish the draft GitHub release that the workflow created for the tag.

Reject a staged version you did not release with `npm stage reject <stage-id>` and
treat it as a security incident. The same applies if the *stage* job fails because the
version is already staged.

## What this protects against

| Attacker has | Result |
|---|---|
| A leaked npm token | Cannot publish. npm doesn't document whether *disallow tokens* also stops a token from staging, so assume it can stage; step 5 catches a stage nobody released. |
| Write access to the repo, or a hijacked maintainer GitHub account | Cannot sign a valid tag. Even a tag with an edited workflow that skips verification can only *stage*. Approval needs npm 2FA. |
| A malicious dependency running during the build | The build job has no OIDC token or secrets. The result is still only staged, and the approver checks it came from the expected run. The approver does not review the code itself. |
| A stolen YubiKey | Signing and npm 2FA also need the FIDO2 PIN, and the key locks after 8 wrong PINs. |

Not covered:
- Someone who controls both a maintainer's YubiKey (and its PIN) and their npm account.
- Repository and organization admins, who can change the rulesets and the environment.
- A software key added to the signer list without the check above. Its signatures would
  carry the same flags as a YubiKey's.

`npm stage publish` attaches provenance when it stages (npm 11 shares the code path
with `npm publish`). Check that the first published version shows it on npmjs.com.

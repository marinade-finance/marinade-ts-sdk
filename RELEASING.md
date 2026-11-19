# Releasing

A release needs a YubiKey twice. Each step is checked by a different system:

```
git tag -s v6.2.0          release.yml (GitHub Actions)                       npmjs.com
YubiKey: touch + PIN  ──►  verify-tag ─► build ─► stage ──► staged, not public ──► Approve
                           sig, signer,  pnpm     npm stage                          YubiKey
                           main, version pack     publish (OIDC)                     (npm 2FA)
```

1. **Signed tag, checked by CI.** The tag must be signed with a FIDO2 SSH key that
   lives on a YubiKey and is listed in [`.github/release-signers`](.github/release-signers).
   [`verify-release-tag.mjs`](.github/scripts/verify-release-tag.mjs) checks the
   signature with `ssh-keygen`. It also checks the FIDO flags inside the signature
   (touch and PIN), because `git verify-tag` and `ssh-keygen -Y verify` accept
   sk-key signatures that have neither.
2. **Staged publish, approved on npm.** CI can only *stage* the package (`npm stage publish`
   through npm trusted publishing; no npm token exists). The version goes public only
   when a maintainer approves it on npm with 2FA, and that 2FA is the YubiKey.
   GitHub cannot bypass this step: npm enforces it.

Why a YubiKey rather than a Ledger: OpenSSH and git support FIDO2 keys natively
(`ed25519-sk`), GitHub shows such signatures as *Verified*, the touch and PIN flags are
part of the signed data, and the same key works as WebAuthn 2FA on npmjs.com.
A Ledger needs a third-party agent (`ledger-agent`) to sign over SSH or GPG.

## One-time setup

### Each release maintainer

Requires a YubiKey 5 (firmware 5.2.3 or later), OpenSSH 8.4 or later and git 2.34 or later. Apple's bundled
`ssh` has no FIDO support, so on macOS install OpenSSH with `brew install openssh`.

```bash
ykman fido access change-pin          # set a FIDO2 PIN if the key has none
ssh-keygen -t ed25519-sk -O resident -O verify-required \
  -O application=ssh:marinade-release -C "you@marinade.finance release" \
  -f ~/.ssh/id_ed25519_sk_release
```

`-O verify-required` makes every signature need the PIN as well as a touch, and CI
rejects signatures without it. `-O resident` stores the key on the YubiKey, so you can
restore it on another machine with `ssh-keygen -K`.

Configure git in your clone:

```bash
git config gpg.format ssh
git config user.signingkey ~/.ssh/id_ed25519_sk_release.pub
git config gpg.ssh.allowedSignersFile .github/release-signers
```

Then:

- Open a PR that adds one line to `.github/release-signers`:
  `you@marinade.finance namespaces="git" sk-ssh-ed25519@openssh.com AAAA...`
  (the first two fields of `~/.ssh/id_ed25519_sk_release.pub`).
- Add the same public key to your GitHub account as a **signing key**, so GitHub shows
  your tags as *Verified*.
- On npmjs.com, register the YubiKey as a **security key** for two-factor
  authentication. You must be a maintainer of `@marinade.finance/marinade-ts-sdk`.

### GitHub repository (admin)

- **Environment `npm`** (Settings → Environments): under *Deployment branches and
  tags*, allow only tags matching `v*`.
- **Tag ruleset for `v*`**: restrict creations to the release maintainers. Restrict
  updates and deletions. Allow no bypass.
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
    2 days, so set it up shortly before the first release.
- *Settings → Publishing access*: **Require two-factor authentication and disallow
  tokens**. Then revoke any existing publish tokens.

## Releasing a version

1. Bump `version` in `package.json` and update `CHANGELOG.md` in a PR, then merge it into `main`.
2. Tag the merged commit. Signing asks for your PIN and a touch:

   ```bash
   git checkout main && git pull
   git tag -s v6.2.0 -m v6.2.0
   ```

3. Optional: run the same check CI runs before pushing:

   ```bash
   node .github/scripts/verify-release-tag.mjs --tag v6.2.0 --signers .github/release-signers --branch origin/main
   ```

4. Push the tag:

   ```bash
   git push origin v6.2.0
   ```

5. When the *Release* workflow is green, its *stage* job summary lists the tarball
   digests. Find the staged version, download it and compare its `sha256sum` with the
   summary:

   ```bash
   npm stage list @marinade.finance/marinade-ts-sdk
   ```

   ```bash
   npm stage download <stage-id>
   ```

6. Approve it, either on npmjs.com (package page, **Staged Packages** tab, **Approve**)
   or from the CLI. Either way npm asks for 2FA: touch the YubiKey.

   ```bash
   npm stage approve <stage-id>
   ```

If a staged version shows up that you did not release, reject it with
`npm stage reject <stage-id>` and investigate.

## What this protects against

| Attacker has | Result |
|---|---|
| A leaked npm token | Nothing: the package accepts no tokens. |
| Write access to the repo, or a hijacked maintainer GitHub account | Cannot sign a valid tag. Even a tag with an edited workflow that skips verification can only *stage*. Approval needs a YubiKey. |
| A malicious dependency running during the build | The build job has no OIDC token or secrets. The result is still only staged, and the approver checks it came from the expected run. The approver does not review the code itself. |
| A stolen YubiKey | Signing and npm 2FA also need the FIDO2 PIN, and the key locks after 8 wrong PINs. |

Not covered: someone who controls both a maintainer's YubiKey (and its PIN) and their
npm account. The npm docs also don't say whether provenance is attached at stage time or
at approval. After the first release, check that the published version shows provenance
on npmjs.com.

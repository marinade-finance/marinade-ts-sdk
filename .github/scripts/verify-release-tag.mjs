#!/usr/bin/env node
// Verifies that a release tag was signed with a FIDO2 security-key SSH key (sk-*) listed
// in the allowed signers file, with the touch and PIN flags set.
//
// usage: node verify-release-tag.mjs --tag v6.2.0 --signers <allowed_signers>
//                                    [--branch origin/main]
//
// A signature can't prove which authenticator made it: software that emulates a FIDO
// key could produce the same signature. That a listed key really lives on a YubiKey is
// checked once, when the key is added to the signer list (see RELEASING.md).
//
// `git verify-tag` / `ssh-keygen -Y verify` alone are not enough: for an sk-* key they
// report a good signature even when the authenticator says nobody touched it and no PIN
// was entered (and allowed_signers has no option to require either). The FIDO flags are
// covered by the signature, so once ssh-keygen has verified it we read them out of the
// SSHSIG blob and require user presence (touch) and user verification (PIN).

import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

const NAMESPACE = 'git'
const HW_KEY_TYPES = new Set([
  'sk-ssh-ed25519@openssh.com',
  'sk-ecdsa-sha2-nistp256@openssh.com',
])
const FLAG_USER_PRESENT = 0x01 // touch
const FLAG_USER_VERIFIED = 0x04 // PIN
const SIG_BEGIN = '-----BEGIN SSH SIGNATURE-----'
const SIG_END = '-----END SSH SIGNATURE-----'

class VerificationError extends Error {}
const fail = msg => {
  throw new VerificationError(msg)
}

const git = (...args) =>
  execFileSync('git', args, { stdio: ['ignore', 'pipe', 'pipe'] })
const gitText = (...args) =>
  git(...args)
    .toString('utf8')
    .trim()

// Minimal reader for the SSH wire format (RFC 4251 string/uint32).
class Reader {
  constructor(buf) {
    this.buf = buf
    this.off = 0
  }
  bytes(n) {
    if (this.off + n > this.buf.length) fail('malformed SSH signature')
    const out = this.buf.subarray(this.off, this.off + n)
    this.off += n
    return out
  }
  u8() {
    return this.bytes(1)[0]
  }
  u32() {
    return this.bytes(4).readUInt32BE(0)
  }
  string() {
    return this.bytes(this.u32())
  }
}

// PROTOCOL.sshsig + PROTOCOL.u2f: returns key type, namespace and FIDO flags.
export function parseSshSig(armored) {
  const body = armored
    .replace(SIG_BEGIN, '')
    .replace(SIG_END, '')
    .replace(/\s+/g, '')
  const r = new Reader(Buffer.from(body, 'base64'))
  if (r.bytes(6).toString() !== 'SSHSIG') fail('not an SSHSIG signature')
  if (r.u32() !== 1) fail('unsupported SSHSIG version')
  const keyType = new Reader(r.string()).string().toString()
  const namespace = r.string().toString()
  r.string() // reserved
  r.string() // hash algorithm
  const sig = new Reader(r.string())
  const sigType = sig.string().toString()
  sig.string() // raw signature
  const isHw = HW_KEY_TYPES.has(keyType)
  if (isHw && sigType !== keyType) fail('signature type does not match key')
  const flags = isHw ? sig.u8() : null
  const counter = isHw ? sig.u32() : null
  return { keyType, namespace, flags, counter }
}

// Splits a raw tag object into the signed payload and the armored SSH signature,
// the same way git does (the signature is appended after the tag message).
// The payload stays a Buffer: the tag text need not be valid UTF-8, and the signature
// covers its exact bytes.
export function splitTagObject(raw) {
  if (raw.includes('-----BEGIN PGP SIGNATURE-----')) {
    fail(
      'tag has a PGP signature; release tags must be signed with an SSH FIDO2 key'
    )
  }
  const at = raw.lastIndexOf(`\n${SIG_BEGIN}\n`)
  if (at < 0) fail('tag is not signed (no SSH signature found)')
  const payload = raw.subarray(0, at + 1)
  const signature = raw.subarray(at + 1).toString('latin1')
  if (
    !new RegExp(`^${SIG_BEGIN}\n[A-Za-z0-9+/=\n]+${SIG_END}\n?$`).test(
      signature
    )
  ) {
    fail('malformed SSH signature block in tag')
  }
  const headers = {}
  for (const line of payload.toString('utf8').split('\n\n')[0].split('\n')) {
    const sp = line.indexOf(' ')
    headers[line.slice(0, sp)] = line.slice(sp + 1)
  }
  return { payload, signature, headers }
}

function sshKeygen(args, input) {
  const res = spawnSync('ssh-keygen', args, { input, encoding: 'utf8' })
  if (res.error) fail(`cannot run ssh-keygen: ${res.error.message}`)
  return res
}

export function verifyReleaseTag({ tag, signers, branch, requirePin = true }) {
  const signerLines = fs
    .readFileSync(signers, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.trim().startsWith('#'))
  if (signerLines.length === 0)
    fail(`no release signers configured in ${signers}`)

  const ref = `refs/tags/${tag}`
  let type
  try {
    type = gitText('cat-file', '-t', ref)
  } catch {
    fail(`tag ${tag} not found`)
  }
  if (type !== 'tag') fail(`${tag} is a lightweight tag; use \`git tag -s\``)

  const { payload, signature, headers } = splitTagObject(
    git('cat-file', 'tag', ref)
  )
  if (headers.tag !== tag) {
    fail(`tag object is named "${headers.tag}" but is referenced as "${tag}"`)
  }
  if (headers.type !== 'commit') fail(`${tag} does not point to a commit`)
  const commit = headers.object
  if (!/^[0-9a-f]{40}([0-9a-f]{24})?$/.test(commit ?? '')) {
    fail(`${tag} has a malformed object header`)
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-tag-'))
  try {
    const sigFile = path.join(tmp, 'tag.sig')
    fs.writeFileSync(sigFile, signature)

    const found = sshKeygen([
      '-Y',
      'find-principals',
      '-s',
      sigFile,
      '-f',
      signers,
    ])
    const principals =
      found.status === 0 ? found.stdout.split('\n').filter(Boolean) : []
    if (principals.length === 0)
      fail(`${tag} is not signed by any key in ${signers}`)

    let verified
    for (const principal of principals) {
      const res = sshKeygen(
        [
          '-Y',
          'verify',
          '-f',
          signers,
          '-I',
          principal,
          '-n',
          NAMESPACE,
          '-s',
          sigFile,
        ],
        payload
      )
      if (res.status === 0) {
        verified = {
          principal,
          message: res.stdout.trim() || res.stderr.trim(),
        }
        break
      }
    }
    if (!verified) fail(`signature on ${tag} is invalid`)

    // Signature is cryptographically valid; the fields below are authenticated.
    const sig = parseSshSig(signature)
    if (sig.namespace !== NAMESPACE)
      fail(`unexpected signature namespace "${sig.namespace}"`)
    if (!HW_KEY_TYPES.has(sig.keyType)) {
      fail(
        `${tag} is signed with a ${sig.keyType} key; a hardware (sk-*) key is required`
      )
    }
    if (!(sig.flags & FLAG_USER_PRESENT)) {
      fail(
        `${tag} was signed without touching the security key (flags 0x${hex(
          sig.flags
        )})`
      )
    }
    if (requirePin && !(sig.flags & FLAG_USER_VERIFIED)) {
      fail(
        `${tag} was signed without the security key PIN (flags 0x${hex(
          sig.flags
        )}); ` + 'create the key with `-O verify-required`'
      )
    }

    if (branch) {
      const onBranch = spawnSync('git', [
        'merge-base',
        '--is-ancestor',
        commit,
        branch,
      ])
      if (onBranch.status !== 0)
        fail(`${tag} points to ${commit}, which is not on ${branch}`)
    }

    const pkg = JSON.parse(
      git('show', `${commit}:package.json`).toString('utf8')
    )
    if (`v${pkg.version}` !== tag) {
      fail(`tag ${tag} does not match package.json version ${pkg.version}`)
    }

    return {
      tag,
      commit,
      version: pkg.version,
      name: pkg.name,
      principal: verified.principal,
      keyType: sig.keyType,
      flags: sig.flags,
      message: verified.message,
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

const hex = n => n.toString(16).padStart(2, '0')

function main() {
  const { values } = parseArgs({
    options: {
      tag: { type: 'string' },
      signers: { type: 'string' },
      branch: { type: 'string' },
    },
  })
  if (!values.tag || !values.signers) {
    console.error(
      'usage: verify-release-tag.mjs --tag <tag> --signers <file> [--branch <ref>]'
    )
    process.exit(2)
  }
  try {
    const r = verifyReleaseTag({
      tag: values.tag,
      signers: values.signers,
      branch: values.branch,
    })
    console.log(r.message)
    console.log(
      `OK: ${r.name}@${r.version} (${r.commit}) signed by ${r.principal}`
    )
    console.log(
      `    ${r.keyType}, flags 0x${hex(r.flags)} (touch${
        r.flags & FLAG_USER_VERIFIED ? ' + PIN' : ''
      })`
    )
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `version=${r.version}\ncommit=${r.commit}\nsigner=${r.principal}\n`
      )
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      fs.appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        [
          `### Release tag \`${r.tag}\` verified`,
          '',
          '| | |',
          '|---|---|',
          `| Package | \`${r.name}@${r.version}\` |`,
          `| Commit | \`${r.commit}\` |`,
          `| Signer | \`${r.principal}\` |`,
          `| Key | \`${r.keyType}\` |`,
          `| FIDO flags | \`0x${hex(r.flags)}\` (touch${
            r.flags & FLAG_USER_VERIFIED ? ' + PIN' : ''
          }) |`,
          '',
        ].join('\n')
      )
    }
  } catch (e) {
    if (!(e instanceof VerificationError)) throw e
    console.error(`::error::Release tag verification failed: ${e.message}`)
    process.exit(1)
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href
) {
  main()
}

// Tests for verify-release-tag.mjs. Run with: node --test .github/scripts/*.test.mjs
//
// A YubiKey can't be plugged into CI, so the hardware signatures are emulated: an
// sk-ssh-ed25519 signature is a plain Ed25519 signature over
// sha256(application) || flags || counter || sha256(SSHSIG signed data), which lets the
// test choose the FIDO flags (touch / PIN) the authenticator would report.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { after, before, describe, test } from 'node:test'
import { verifyReleaseTag } from './verify-release-tag.mjs'

const SK = 'sk-ssh-ed25519@openssh.com'
const u32 = n => {
  const b = Buffer.alloc(4)
  b.writeUInt32BE(n >>> 0)
  return b
}
const str = s => {
  const b = Buffer.isBuffer(s) ? s : Buffer.from(s)
  return Buffer.concat([u32(b.length), b])
}
const sha = (alg, d) => crypto.createHash(alg).update(d).digest()
const armor = blob =>
  `-----BEGIN SSH SIGNATURE-----\n${blob
    .toString('base64')
    .match(/.{1,70}/g)
    .join('\n')}\n-----END SSH SIGNATURE-----\n`

function fakeYubiKey(app = 'ssh:') {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519')
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32)
  const pubBlob = Buffer.concat([str(SK), str(raw), str(app)])
  return {
    publicLine: `${SK} ${pubBlob.toString('base64')}`,
    sign(message, flags, namespace = 'git') {
      const signed = Buffer.concat([
        Buffer.from('SSHSIG'),
        str(namespace),
        str(''),
        str('sha512'),
        str(sha('sha512', message)),
      ])
      const toSign = Buffer.concat([
        sha('sha256', app),
        Buffer.from([flags]),
        u32(7),
        sha('sha256', signed),
      ])
      const sig = Buffer.concat([
        str(SK),
        str(crypto.sign(null, toSign, privateKey)),
        Buffer.from([flags]),
        u32(7),
      ])
      return armor(
        Buffer.concat([
          Buffer.from('SSHSIG'),
          u32(1),
          str(pubBlob),
          str(namespace),
          str(''),
          str('sha512'),
          str(sig),
        ])
      )
    },
  }
}

const TOUCH = 0x01
const PIN = 0x04

describe('verify-release-tag', () => {
  let dir, repo, signers, yubikey, otherYubikey, softKey, mainCommit, sideCommit
  const run = (cmd, args, opts = {}) =>
    execFileSync(cmd, args, { cwd: repo, encoding: 'utf8', ...opts }).trim()
  const commitWith = (version, branch) => {
    run('git', ['checkout', '-q', '-B', branch])
    fs.writeFileSync(
      path.join(repo, 'package.json'),
      JSON.stringify({ name: 'pkg', version })
    )
    run('git', ['add', 'package.json'])
    run('git', ['commit', '-q', '-m', `v${version}`])
    return run('git', ['rev-parse', 'HEAD'])
  }
  // Writes a signed annotated tag object exactly like `git tag -s` does.
  const makeTag = ({
    ref,
    name = ref,
    commit = mainCommit,
    sign,
    tamper = false,
  }) => {
    const payload =
      `object ${commit}\ntype commit\ntag ${name}\n` +
      `tagger Rel <rel@example.com> 1763500000 +0000\n\n${name}\n`
    const signature = sign(payload)
    const body =
      (tamper ? payload.replace(/\n\n.*\n$/, '\n\nevil\n') : payload) +
      signature
    const sha1 = run('git', ['hash-object', '-t', 'tag', '-w', '--stdin'], {
      input: body,
    })
    run('git', ['update-ref', `refs/tags/${ref}`, sha1])
  }
  const verify = (tag, extra = {}) =>
    verifyReleaseTag({ tag, signers, branch: 'main', ...extra })

  before(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-release-tag-test-'))
    repo = path.join(dir, 'repo')
    fs.mkdirSync(repo)
    run('git', ['init', '-q', '-b', 'main'])
    run('git', ['config', 'user.email', 'dev@example.com'])
    run('git', ['config', 'user.name', 'dev'])
    mainCommit = commitWith('6.2.0', 'main')
    sideCommit = commitWith('6.3.0', 'side')
    run('git', ['checkout', '-q', 'main'])

    yubikey = fakeYubiKey()
    otherYubikey = fakeYubiKey()
    const softKeyFile = path.join(dir, 'soft')
    execFileSync('ssh-keygen', [
      '-q',
      '-t',
      'ed25519',
      '-N',
      '',
      '-f',
      softKeyFile,
    ])
    softKey = {
      publicLine: fs
        .readFileSync(`${softKeyFile}.pub`, 'utf8')
        .split(' ')
        .slice(0, 2)
        .join(' '),
      sign(message) {
        const msgFile = path.join(dir, 'msg')
        fs.writeFileSync(msgFile, message)
        execFileSync('ssh-keygen', [
          '-q',
          '-Y',
          'sign',
          '-n',
          'git',
          '-f',
          softKeyFile,
          msgFile,
        ])
        return fs.readFileSync(`${msgFile}.sig`, 'utf8')
      },
    }
    signers = path.join(dir, 'release-signers')
    fs.writeFileSync(
      signers,
      [
        '# comment',
        `rel@example.com namespaces="git" ${yubikey.publicLine}`,
        `soft@example.com namespaces="git" ${softKey.publicLine}`,
        '',
      ].join('\n')
    )
    process.chdir(repo)
  })
  after(() => fs.rmSync(dir, { recursive: true, force: true }))

  test('accepts a tag signed on the security key with touch + PIN', () => {
    makeTag({ ref: 'v6.2.0', sign: p => yubikey.sign(p, TOUCH | PIN) })
    const r = verify('v6.2.0')
    assert.equal(r.commit, mainCommit)
    assert.equal(r.version, '6.2.0')
    assert.equal(r.principal, 'rel@example.com')
    assert.equal(r.flags, TOUCH | PIN)
  })

  test('rejects a signature made without touching the key', () => {
    makeTag({ ref: 'v6.2.0', sign: p => yubikey.sign(p, PIN) })
    assert.throws(() => verify('v6.2.0'), /without touching the security key/)
  })

  test('rejects a signature made without the PIN, unless --allow-no-pin', () => {
    makeTag({ ref: 'v6.2.0', sign: p => yubikey.sign(p, TOUCH) })
    assert.throws(() => verify('v6.2.0'), /without the security key PIN/)
    assert.equal(verify('v6.2.0', { requirePin: false }).flags, TOUCH)
  })

  test('rejects a listed key that is not hardware-backed', () => {
    makeTag({ ref: 'v6.2.0', sign: p => softKey.sign(p) })
    assert.throws(() => verify('v6.2.0'), /hardware \(sk-\*\) key is required/)
  })

  test('rejects a security key that is not in the signers file', () => {
    makeTag({ ref: 'v6.2.0', sign: p => otherYubikey.sign(p, TOUCH | PIN) })
    assert.throws(() => verify('v6.2.0'), /not signed by any key/)
  })

  test('rejects a tag whose content was changed after signing', () => {
    makeTag({
      ref: 'v6.2.0',
      sign: p => yubikey.sign(p, TOUCH | PIN),
      tamper: true,
    })
    assert.throws(() => verify('v6.2.0'), /signature on v6.2.0 is invalid/)
  })

  test('rejects a signature from another namespace', () => {
    makeTag({ ref: 'v6.2.0', sign: p => yubikey.sign(p, TOUCH | PIN, 'file') })
    assert.throws(() => verify('v6.2.0'), /invalid/)
  })

  test('rejects a signed tag object re-used under another tag name', () => {
    makeTag({
      ref: 'v6.2.1',
      name: 'v6.2.0',
      sign: p => yubikey.sign(p, TOUCH | PIN),
    })
    assert.throws(
      () => verify('v6.2.1'),
      /named "v6.2.0" but is referenced as "v6.2.1"/
    )
  })

  test('rejects a tag whose version does not match package.json', () => {
    makeTag({ ref: 'v6.2.9', sign: p => yubikey.sign(p, TOUCH | PIN) })
    assert.throws(
      () => verify('v6.2.9'),
      /does not match package.json version 6.2.0/
    )
  })

  test('rejects a tag on a commit that is not on the release branch', () => {
    makeTag({
      ref: 'v6.3.0',
      commit: sideCommit,
      sign: p => yubikey.sign(p, TOUCH | PIN),
    })
    assert.throws(() => verify('v6.3.0'), /not on main/)
    assert.equal(verify('v6.3.0', { branch: undefined }).version, '6.3.0')
  })

  test('rejects lightweight and unsigned tags', () => {
    run('git', ['tag', '-f', 'v6.2.0'])
    assert.throws(() => verify('v6.2.0'), /lightweight tag/)
    run('git', ['tag', '-f', '-a', '-m', 'v6.2.0', 'v6.2.0'])
    assert.throws(() => verify('v6.2.0'), /not signed/)
  })

  test('fails closed when no signers are configured', () => {
    const empty = path.join(dir, 'empty-signers')
    fs.writeFileSync(empty, '# no keys yet\n')
    assert.throws(
      () => verify('v6.2.0', { signers: empty }),
      /no release signers configured/
    )
  })
})

import { Connection, PublicKey } from '@solana/web3.js'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

// adapted from https://github.com/marinade-finance/solana-js-utils/blob/main/packages/solana-test-utils/runner.ts

export type AddressToPath = { address: PublicKey; path: string };
export type AddressDirectory = { directory: string };

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) )
}

/**
 * Recursively read a directory and return all the files in it as an array.
 * If the file is a 'json' or 'so' it takes the basename as the Public key address.
 */
async function readDirRecursive(dirPath: string): Promise<AddressToPath[]> {
  const fileNames: AddressToPath[] = []
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isFile()) {
      const extension = path.extname(fullPath)
      if (extension === '.json' || extension === '.so') {
        const baseName = path.basename(fullPath, path.extname(fullPath))
        const address = new PublicKey(baseName)
        fileNames.push({address, path: fullPath})
      }
    } else if (entry.isDirectory()) {
      const subFileNames = await readDirRecursive(fullPath)
      fileNames.push(...subFileNames)
    }
  }

  return fileNames
}

export async function run(bpfPrograms: AddressToPath[] | AddressDirectory = [], accounts: AddressToPath[] | AddressDirectory = [],  args: string[] = []) {
  if (!Array.isArray(bpfPrograms) && 'directory' in bpfPrograms) {
    bpfPrograms = await readDirRecursive(bpfPrograms.directory)
  }
  if (!Array.isArray(accounts) && 'directory' in accounts) {
    accounts = await readDirRecursive(accounts.directory)
  }

  bpfPrograms.forEach(({ path, address }) => {
    args = args.concat(['--bpf-program', address.toBase58(), path])
  })
  accounts.forEach(({ path, address }) => {
    args = args.concat(['--account', address.toBase58(), path])
  })
  console.log('Starting test validator')
  const testValidator = spawn('solana-test-validator', args)

  testValidator.stderr.on('data', data => console.log(data.toString('latin1')))
  try {
    let closed = false
    testValidator.on('close', () => {
      closed = true
    })
    const connection = new Connection('http://localhost:8899')
    let wait = 80000
    const step = 100
    while (wait > 0 && !closed) {
      try {
        await connection.getLatestBlockhash()
        break
      } catch (e) {
        await delay(step)
        wait -= step
      }
    }
    if (closed) {
      throw new Error('Test validator was closed')
    }
    if (wait <= 0) {
      throw new Error(
        'Unable to get latest blockhash. Test validator does not look started'
      )
    }
    console.log('Test validator online')

    const test = spawn('npm', ['run', '_test:integration'], { stdio: 'inherit' })
    await new Promise((resolve, reject) =>
      test.on('close', code => {
        if (code) {
          reject(code)
        } else {
          resolve(null)
        }
      })
    )
  } finally {
    testValidator.kill()
  }
}

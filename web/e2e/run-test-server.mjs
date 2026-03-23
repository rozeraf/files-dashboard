import { spawn } from 'node:child_process'
import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_PORT = 4541
const TEST_APP_NAME = 'Files Dashboard E2E'
const TEST_ROOT_ID = 'playwright-root'
const TEST_ROOT_LABEL = 'Playwright Root'
const BULK_FILE_COUNT = 55
const UNIQUE_FILE_NAME = 'needle-target.txt'
const SECONDARY_FILE_NAME = 'summary-report.txt'
const NESTED_DIR_NAME = 'folder-alpha'
const NESTED_FILE_NAME = 'nested-note.txt'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..', '..')
const runtimeRoot = '/tmp/files-dashboard-playwright'
const dataDir = join(runtimeRoot, 'data')
const rootDir = join(runtimeRoot, 'root')
const goCacheDir = join(runtimeRoot, 'go-cache')
const goTmpDir = join(runtimeRoot, 'go-tmp')
const webDir = resolve(__dirname, '..')
const embeddedStaticDir = join(repoRoot, 'internal', 'httpapi', 'static')

async function ensureFixtureTree() {
  await rm(runtimeRoot, { force: true, recursive: true })
  await mkdir(dataDir, { recursive: true })
  await mkdir(rootDir, { recursive: true })
  await mkdir(goCacheDir, { recursive: true })
  await mkdir(goTmpDir, { recursive: true })

  await writeFile(join(rootDir, UNIQUE_FILE_NAME), 'playwright unique file\n')
  await writeFile(join(rootDir, SECONDARY_FILE_NAME), 'secondary report\n')

  const nestedDir = join(rootDir, NESTED_DIR_NAME)
  await mkdir(nestedDir, { recursive: true })
  await writeFile(join(nestedDir, NESTED_FILE_NAME), 'nested note\n')

  const bulkWrites = Array.from({ length: BULK_FILE_COUNT }, (_, index) => {
    const name = `bulk-${String(index + 1).padStart(3, '0')}.txt`
    return writeFile(join(rootDir, name), `bulk file ${index + 1}\n`)
  })
  await Promise.all(bulkWrites)

  const config = {
    host: '127.0.0.1',
    port: TEST_PORT,
    app_name: TEST_APP_NAME,
    lan_enabled: false,
    roots: [
      {
        id: TEST_ROOT_ID,
        path: rootDir,
        label: TEST_ROOT_LABEL,
      },
    ],
  }

  await writeFile(join(dataDir, 'config.json'), `${JSON.stringify(config, null, 2)}\n`)
}

function runCommand(command, args, cwd, env = process.env) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio: 'inherit',
    })

    child.on('exit', code => {
      if (code === 0) {
        resolvePromise()
        return
      }
      rejectPromise(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`))
    })
  })
}

await ensureFixtureTree()
await runCommand('bun', ['run', 'build'], webDir)
await rm(embeddedStaticDir, { force: true, recursive: true })
await mkdir(embeddedStaticDir, { recursive: true })
await cp(join(webDir, 'dist'), embeddedStaticDir, { recursive: true })

const server = spawn('go', ['run', './cmd/app'], {
  cwd: repoRoot,
  env: {
    ...process.env,
    DATA_DIR: dataDir,
    GOCACHE: goCacheDir,
    GOTMPDIR: goTmpDir,
  },
  stdio: 'inherit',
})

const stopServer = () => {
  if (!server.killed) {
    server.kill('SIGTERM')
  }
}

process.on('SIGINT', stopServer)
process.on('SIGTERM', stopServer)
process.on('exit', stopServer)

server.on('exit', code => {
  process.exit(code ?? 0)
})

import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const source = resolve('CHANGELOG.md')
const destination = resolve('public', 'CHANGELOG.md')

await mkdir(dirname(destination), { recursive: true })
await copyFile(source, destination)

console.log(`Synced ${source} -> ${destination}`)

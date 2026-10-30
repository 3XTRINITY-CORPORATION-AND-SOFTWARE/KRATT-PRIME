#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const dist = path.join(root, 'dist')
const out = '/workspace/trinitywayve-aura-deploy.json'

if (!fs.existsSync(dist)) {
  console.error('dist/ missing — run npm run build first')
  process.exit(1)
}

const TEXT_EXT = new Set(['.html', '.js', '.css', '.svg', '.json', '.txt', '.webmanifest', '.map'])

function walk(dir, base = '') {
  const entries = []
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = path.join(base, name).replace(/\\/g, '/')
    const st = fs.statSync(full)
    if (st.isDirectory()) entries.push(...walk(full, rel))
    else entries.push({ rel, full })
  }
  return entries
}

const files = walk(dist).map(({ rel, full }) => {
  const ext = path.extname(rel).toLowerCase()
  const buf = fs.readFileSync(full)
  if (TEXT_EXT.has(ext) || rel === 'index.html') {
    return { file: rel, data: buf.toString('utf8'), encoding: 'utf-8' }
  }
  return { file: rel, data: buf.toString('base64'), encoding: 'base64' }
})

const payload = {
  target: 'production',
  name: 'trinitywayve-aura',
  files,
  projectSettings: { framework: null, outputDirectory: null },
}

const json = JSON.stringify(payload)
fs.writeFileSync(out, json)
const kb = (Buffer.byteLength(json) / 1024).toFixed(1)
console.log(`Wrote ${out} — ${files.length} files, ${kb} KB`)
if (Buffer.byteLength(json) > 400 * 1024) {
  console.warn('Warning: deploy JSON exceeds 400KB target')
  process.exitCode = 2
}

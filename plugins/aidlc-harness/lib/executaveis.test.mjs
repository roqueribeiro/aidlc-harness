#!/usr/bin/env node
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { comandoDoGate } from './executaveis.mjs'

test('nome do kit vira node + caminho; o resto do comando fica', () => {
  const d = mkdtempSync(join(tmpdir(), 'aidlc-exec-'))
  writeFileSync(join(d, 'aidlc-secscan'), '')
  writeFileSync(join(d, 'aidlc-lockcheck'), '')
  try {
    const n = '/opt/node/bin/node'
    assert.equal(comandoDoGate('aidlc-secscan', d, n), `"${n}" "${join(d, 'aidlc-secscan')}"`)
    assert.equal(comandoDoGate('aidlc-lockcheck --base main && aidlc-secscan', d, n), `"${n}" "${join(d, 'aidlc-lockcheck')}" --base main && "${n}" "${join(d, 'aidlc-secscan')}"`)
    assert.equal(comandoDoGate('yarn test', d, n), 'yarn test')
    assert.equal(comandoDoGate('aidlc-inexistente x', d, n), 'aidlc-inexistente x', 'nome que o kit não tem fica como está')
    assert.equal(comandoDoGate('echo aidlc-secscan', d, n), 'echo aidlc-secscan', 'argumento não é comando')
  } finally {
    rmSync(d, { recursive: true, force: true })
  }
})

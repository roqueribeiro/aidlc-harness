#!/usr/bin/env node
/*
 * Detecção de tecnologia e manifestos do projeto (.aidlc/quality).
 * O que importa provar: o kit reconhece a stack, o projeto pode ajustar sem forkar o kit, e um
 * manifesto quebrado do projeto não derruba nada nem some em silêncio.
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { detectTech, manifestosDoProjeto, loadManifests } from './detect.mjs'

const projeto = (arquivos) => {
  const d = mkdtempSync(join(tmpdir(), 'aidlc-detect-'))
  for (const [f, c] of Object.entries(arquivos)) {
    mkdirSync(dirname(join(d, f)), { recursive: true })
    writeFileSync(join(d, f), typeof c === 'string' ? c : JSON.stringify(c))
  }
  return d
}
const limpa = (d) => rmSync(d, { recursive: true, force: true })

describe('detecção pelo kit', () => {
  test('yarn.lock + package.json = node-yarn; package-lock.json = node-npm', () => {
    const y = projeto({ 'package.json': { name: 'a' }, 'yarn.lock': '' })
    const n = projeto({ 'package.json': { name: 'a' }, 'package-lock.json': '{}' })
    assert.equal(detectTech(y)?.tech, 'node-yarn')
    assert.equal(detectTech(n)?.tech, 'node-npm')
    limpa(y)
    limpa(n)
  })

  test('pyproject + uv.lock = python-uv', () => {
    const d = projeto({ 'pyproject.toml': '[project]\nname="x"\n', 'uv.lock': '' })
    assert.equal(detectTech(d)?.tech, 'python-uv')
    limpa(d)
  })

  test('diretório sem marcador não é reconhecido: nunca inventa tecnologia', () => {
    const d = projeto({ 'leia.txt': 'oi' })
    assert.equal(detectTech(d), null)
    limpa(d)
  })

  test('o gate do próprio kit exige a pasta do plugin E o OPERATING-MODEL.md', () => {
    const so1 = projeto({ 'OPERATING-MODEL.md': '#' })
    const so2 = projeto({ 'plugins/aidlc-harness/x': '' })
    assert.equal(detectTech(so1), null)
    assert.equal(detectTech(so2), null)
    limpa(so1)
    limpa(so2)
  })
})

describe('manifestos do projeto', () => {
  test('mesmo tech substitui o do kit; o gate herdado de lockfile continua valendo', () => {
    const d = projeto({
      'package.json': { name: 'a' },
      'yarn.lock': '',
      '.aidlc/quality/node-yarn.json': {
        tech: 'node-yarn',
        label: 'Node yarn do time',
        repos: ['a'],
        pkgManager: 'yarn',
        detect: { allFiles: ['package.json', 'yarn.lock'], priority: 20 },
        gates: [{ id: 'test', label: 'teste do time', cmd: 'yarn test:ci', blocking: true }],
        evidence: [],
      },
    })
    const m = detectTech(d)
    assert.equal(m.label, 'Node yarn do time')
    assert.equal(m.gates.find((g) => g.id === 'test').cmd, 'yarn test:ci')
    assert.ok(m.gates.some((g) => g.id === 'lockfile' && g.inherited === '_org'), 'camada org segue valendo')
    limpa(d)
  })

  test('tech novo é acrescentado e é reconhecido', () => {
    const d = projeto({
      'go.mod': 'module x\n',
      '.aidlc/quality/go.json': {
        tech: 'go',
        label: 'Go',
        repos: ['x'],
        pkgManager: 'none',
        detect: { allFiles: ['go.mod'], priority: 20 },
        gates: [{ id: 'test', label: 'go test', cmd: 'go test ./...', blocking: true }],
        evidence: [],
      },
    })
    assert.equal(detectTech(d)?.tech, 'go')
    assert.ok(loadManifests(d).some((m) => m.tech === 'node-yarn'), 'os do kit continuam')
    limpa(d)
  })

  test('manifesto quebrado é ignorado, reportado, e não derruba a detecção do kit', () => {
    const d = projeto({ 'package.json': { name: 'a' }, 'yarn.lock': '', '.aidlc/quality/ruim.json': '{ isto nao e json', '.aidlc/quality/incompleto.json': { tech: 'x' } })
    const { manifestos, erros } = manifestosDoProjeto(d)
    assert.equal(manifestos.length, 0)
    assert.equal(erros.length, 2, 'nada some em silêncio')
    assert.equal(detectTech(d)?.tech, 'node-yarn')
    limpa(d)
  })

  test('sem .aidlc/quality, nada muda', () => {
    const d = projeto({ 'package.json': { name: 'a' }, 'yarn.lock': '' })
    assert.deepEqual(manifestosDoProjeto(d), { manifestos: [], erros: [] })
    limpa(d)
  })
})

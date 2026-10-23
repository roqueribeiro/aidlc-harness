#!/usr/bin/env node
/*
 * Testes do que no package.json pede lockfile novo, e do aidlc-lockcheck de ponta a ponta num
 * repo git de verdade (temporario).
 *
 * O caso que abriu isto: mudar so dois scripts do package.json (um argumento de deploy) e o
 * lockcheck reprovar por `lock-para-tras`, pedindo um yarn.lock que o yarn nunca regeneraria.
 *
 * Uso: node plugins/aidlc-harness/lib/lockcheck.test.mjs
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { camposDoLock, dependenciasMudaram } from './lockcheck.mjs'

const BASE = {
  name: 'x',
  version: '1.0.0',
  scripts: { deploy: 'node deploy.mjs' },
  dependencies: { vue: '3.5.0', pinia: '2.0.0' },
  devDependencies: { vitest: '3.0.0' },
  resolutions: { 'app-sdk': '1.0.0' },
}
const com = (mudanca) => ({ ...structuredClone(BASE), ...mudanca })

describe('o que pede lockfile novo', () => {
  test('mudar so script, nome ou versao nao pede', () => {
    assert.equal(dependenciasMudaram(BASE, com({ scripts: { deploy: 'node deploy.mjs --producao' } })), false)
    assert.equal(dependenciasMudaram(BASE, com({ name: 'y', version: '2.0.0' })), false)
  })
  test('dependencia nova, trocada ou removida pede', () => {
    assert.equal(dependenciasMudaram(BASE, com({ dependencies: { ...BASE.dependencies, lodash: '4.0.0' } })), true)
    assert.equal(dependenciasMudaram(BASE, com({ dependencies: { vue: '3.5.1', pinia: '2.0.0' } })), true)
    assert.equal(dependenciasMudaram(BASE, com({ devDependencies: {} })), true)
    assert.equal(dependenciasMudaram(BASE, com({ optionalDependencies: { fsevents: '2.0.0' } })), true)
  })
  test('resolutions, overrides e workspaces pedem', () => {
    assert.equal(dependenciasMudaram(BASE, com({ resolutions: { 'app-sdk': '1.1.0' } })), true)
    assert.equal(dependenciasMudaram(BASE, com({ overrides: { a: '1.0.0' } })), true)
    assert.equal(dependenciasMudaram(BASE, com({ workspaces: ['pacotes/*'] })), true)
  })
  test('reordenar as dependencias nao pede', () => {
    assert.equal(dependenciasMudaram(BASE, com({ dependencies: { pinia: '2.0.0', vue: '3.5.0' } })), false)
  })
  test('peerDependencies: no yarn.lock nao pede, no package-lock pede', () => {
    const peer = com({ peerDependencies: { vue: '^3.0.0' } })
    assert.equal(dependenciasMudaram(BASE, peer, 'yarn.lock'), false)
    assert.equal(dependenciasMudaram(BASE, peer, 'package-lock.json'), true)
    assert.deepEqual(Object.keys(camposDoLock(peer, 'yarn.lock')).sort(), ['dependencies', 'devDependencies', 'resolutions'])
  })
})

describe('aidlc-lockcheck num repo git de verdade', () => {
  const TOOL = fileURLToPath(new URL('../tools/aidlc-lockcheck', import.meta.url))
  const git = (dir, ...args) =>
    execFileSync('git', ['-c', 'user.name=teste', '-c', 'user.email=teste@exemplo', ...args], { cwd: dir, stdio: 'pipe' })
  const repo = () => {
    const dir = mkdtempSync(join(tmpdir(), 'lockcheck-'))
    git(dir, 'init', '-q')
    writeFileSync(join(dir, 'package.json'), JSON.stringify(BASE, null, 2))
    // O lockfile conhece as quatro dependencias declaradas (regra 2).
    writeFileSync(join(dir, 'yarn.lock'), ['vue@3.5.0:', 'pinia@2.0.0:', 'vitest@3.0.0:', 'app-sdk@1.0.0:', ''].join('\n'))
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'base')
    return dir
  }
  const rodar = (dir) => {
    const r = spawnSync('node', [TOOL, '--json', dir], { encoding: 'utf8' })
    return { codigo: r.status, saida: JSON.parse(r.stdout) }
  }

  test('so um script mudou, sem lockfile novo: passa', () => {
    const dir = repo()
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify(com({ scripts: { deploy: 'node deploy.mjs --producao' } }), null, 2))
      const { codigo, saida } = rodar(dir)
      assert.equal(codigo, 0, JSON.stringify(saida.problemas))
      assert.equal(saida.packageJsonMudou, false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('uma versao de dependencia mudou, sem lockfile novo: reprova por lock-para-tras', () => {
    const dir = repo()
    try {
      writeFileSync(join(dir, 'package.json'), JSON.stringify(com({ dependencies: { vue: '3.5.1', pinia: '2.0.0' } }), null, 2))
      const { codigo, saida } = rodar(dir)
      assert.equal(codigo, 1)
      assert.deepEqual(saida.problemas.map((p) => p.regra), ['lock-para-tras'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('package.json novo com lockfile velho: reprova (tudo que ele declara e novo)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lockcheck-'))
    try {
      git(dir, 'init', '-q')
      writeFileSync(join(dir, 'yarn.lock'), ['vue@3.5.0:', 'pinia@2.0.0:', 'vitest@3.0.0:', 'app-sdk@1.0.0:', ''].join('\n'))
      git(dir, 'add', '-A')
      git(dir, 'commit', '-q', '-m', 'so o lock')
      writeFileSync(join(dir, 'package.json'), JSON.stringify(BASE, null, 2))
      const { codigo, saida } = rodar(dir)
      assert.equal(codigo, 1)
      assert.deepEqual(saida.problemas.map((p) => p.regra), ['lock-para-tras'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  const semLockfile = (pkg) => {
    const dir = mkdtempSync(join(tmpdir(), 'lockcheck-'))
    git(dir, 'init', '-q')
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2))
    git(dir, 'add', '-A')
    git(dir, 'commit', '-q', '-m', 'base')
    return dir
  }

  test('package.json sem nenhuma dependencia e sem lockfile: passa (nada a travar)', () => {
    const dir = semLockfile({ name: 'x', private: true, scripts: { test: 'node --test' } })
    try {
      const { codigo, saida } = rodar(dir)
      assert.equal(codigo, 0, JSON.stringify(saida.problemas))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('mutante: dependencia declarada e nenhum lockfile reprova por lockfile-ausente', () => {
    const dir = semLockfile({ name: 'x', dependencies: { vue: '3.5.0' } })
    try {
      const { codigo, saida } = rodar(dir)
      assert.equal(codigo, 1)
      assert.ok(saida.problemas.some((p) => p.regra === 'lockfile-ausente'), JSON.stringify(saida.problemas))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
  test('mutante: so devDependencies, resolutions ou workspaces tambem exigem lockfile', () => {
    for (const pkg of [
      { name: 'x', devDependencies: { vitest: '3.0.0' } },
      { name: 'x', resolutions: { 'app-sdk': '1.0.0' } },
      { name: 'x', workspaces: ['pacotes/*'] },
    ]) {
      const dir = semLockfile(pkg)
      try {
        const { codigo, saida } = rodar(dir)
        assert.equal(codigo, 1, JSON.stringify(pkg))
        assert.ok(saida.problemas.some((p) => p.regra === 'lockfile-ausente'), JSON.stringify(pkg))
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  })
})

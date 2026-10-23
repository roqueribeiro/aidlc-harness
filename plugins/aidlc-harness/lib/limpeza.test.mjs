#!/usr/bin/env node
/*
 * O inventario de limpeza num repo git de verdade com remoto (temporario): o que o remoto ja
 * guarda e lixo e sai com --apagar; o que perderia trabalho fica em "decidir" e sobrevive.
 * Uso: node plugins/aidlc-harness/lib/limpeza.test.mjs
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inventarioRepo, parseSonda, lixoNoServidor, parseWorktrees, limpaDocker, SONDA_DOCKER } from './limpeza.mjs'

const TOOL = fileURLToPath(new URL('../tools/aidlc-limpeza', import.meta.url))
const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

function bancada() {
  const dir = mkdtempSync(join(tmpdir(), 'limpeza-'))
  const remoto = join(dir, 'remoto.git')
  const repo = join(dir, 'repo')
  g(dir, 'init', '-q', '--bare', remoto)
  g(dir, 'clone', '-q', remoto, repo)
  g(repo, 'config', 'user.email', 't@t')
  g(repo, 'config', 'user.name', 't')
  writeFileSync(join(repo, 'a.txt'), '1')
  g(repo, 'add', '.')
  g(repo, 'commit', '-qm', 'a')
  g(repo, 'push', '-q', 'origin', 'HEAD:main')
  // unidade1: ja no remoto, num worktree limpo -> lixo
  g(repo, 'branch', 'unidade1')
  g(repo, 'push', '-q', 'origin', 'unidade1')
  g(repo, 'worktree', 'add', '-q', join(dir, 'wt-unidade1'), 'unidade1')
  // unidade2: commit local que nenhum remoto tem -> decidir
  g(repo, 'worktree', 'add', '-q', '-b', 'unidade2', join(dir, 'wt-unidade2'))
  writeFileSync(join(dir, 'wt-unidade2', 'b.txt'), '2')
  g(join(dir, 'wt-unidade2'), 'add', '.')
  g(join(dir, 'wt-unidade2'), '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'b')
  // wt sujo -> decidir
  g(repo, 'worktree', 'add', '-q', '--detach', join(dir, 'wt-sujo'))
  writeFileSync(join(dir, 'wt-sujo', 'c.txt'), '3')
  return { dir, repo }
}

describe('inventario de repo', () => {
  test('separa lixo de decisao', () => {
    const { dir, repo } = bancada()
    try {
      const r = inventarioRepo(repo)
      const lixo = r.lixo.map((i) => `${i.tipo}:${i.alvo.split('/').pop()}`).sort()
      const decidir = r.decidir.map((i) => i.tipo).sort()
      assert.deepEqual(lixo, ['branch:unidade1', 'worktree:wt-unidade1'])
      assert.deepEqual(decidir, ['branch-sem-remoto', 'worktree-sem-remoto', 'worktree-sujo'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('--apagar tira so o lixo', () => {
    const { dir, repo } = bancada()
    try {
      const r = spawnSync(process.execPath, [TOOL, '--apagar'], { cwd: repo, encoding: 'utf8' })
      assert.equal(r.status, 1, 'sobra decisao, entao nao esta limpo')
      assert.equal(existsSync(join(dir, 'wt-unidade1')), false)
      assert.equal(existsSync(join(dir, 'wt-unidade2')), true)
      assert.equal(existsSync(join(dir, 'wt-sujo', 'c.txt')), true)
      assert.match(g(repo, 'branch'), /unidade2/)
      assert.doesNotMatch(g(repo, 'branch'), /unidade1/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('repo arrumado sai 0 com a linha de evidencia', () => {
    const { dir, repo } = bancada()
    try {
      g(repo, 'worktree', 'remove', '--force', join(dir, 'wt-sujo'))
      g(repo, 'worktree', 'remove', '--force', join(dir, 'wt-unidade2'))
      g(repo, 'branch', '-D', 'unidade2')
      const r = spawnSync(process.execPath, [TOOL, '--apagar'], { cwd: repo, encoding: 'utf8' })
      assert.equal(r.status, 0, r.stdout)
      assert.match(r.stdout, /aidlc-limpeza: nada sobrando/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('principal', () => {
  test('HEAD fora da principal e arvore suja sao decisao', () => {
    const { dir, repo } = bancada()
    try {
      g(repo, 'checkout', '-q', '-b', 'unidade3')
      writeFileSync(join(repo, 'd.txt'), '4')
      g(repo, 'add', '.')
      g(repo, 'commit', '-qm', 'd')
      g(repo, 'push', '-q', 'origin', 'unidade3')
      writeFileSync(join(repo, 'e.txt'), '5')
      const tipos = inventarioRepo(repo).decidir.map((i) => i.tipo)
      assert.ok(tipos.includes('head-fora-da-principal'))
      assert.ok(tipos.includes('arvore-suja'))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('manter', () => {
  test('branch declarada em aidlc.manter (e kit-servido) nao e lixo', () => {
    const { dir, repo } = bancada()
    try {
      g(repo, 'config', '--add', 'aidlc.manter', 'unidade1')
      const r = inventarioRepo(repo)
      assert.equal(r.lixo.length, 0, JSON.stringify(r.lixo))
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('servidor', () => {
  const sonda = 'u12-carga-1\nu12-carga-2\n---\n7\n---\nImages|50.18GB (54%)\nBuild Cache|75.28GB\n'
  test('parse da sonda', () => {
    const s = parseSonda(sonda)
    assert.deepEqual(s.parados, ['u12-carga-1', 'u12-carga-2'])
    assert.equal(s.orfas, 7)
    assert.equal(s.recuperavel['Build Cache'], '75.28GB')
    assert.equal(lixoNoServidor(s), true)
  })
  test('release antiga sem uso e lixo, e so ela entra no rmi', () => {
    const velha = 'sha256:' + 'a'.repeat(64)
    const s = parseSonda(`---\n0\n---\n${velha}\n---\nBuild Cache|0B\n`)
    assert.deepEqual(s.antigas, [velha])
    assert.equal(lixoNoServidor(s), true)
    const cmd = limpaDocker([], [velha, 'plex; rm -rf /'])
    assert.match(cmd, new RegExp(`docker rmi ${velha}`))
    assert.doesNotMatch(cmd, /rm -rf/)
  })
  test('a sonda nunca conta como release velha a tag de rollback do install.sh', () => {
    // O bloco 3 da sonda roda no servidor; aqui o awk dele roda sobre a saida do docker images.
    const awk = /awk '([^']+)'/.exec(SONDA_DOCKER.split('echo ---;')[2])[1]
    const id = (c) => 'sha256:' + c.repeat(64)
    const lista = [`api-exemplo latest ${id('1')}`, `api-exemplo previous ${id('2')}`, `api-exemplo rollback ${id('2')}`, `app v4 ${id('3')}`, `app v3 ${id('4')}`, `app v2 ${id('5')}`, `app v1 ${id('6')}`].join('\n')
    const r = spawnSync('awk', [awk], { input: lista, encoding: 'utf8' })
    assert.deepEqual(r.stdout.trim().split('\n'), [id('6')])
  })
  test('as tres releases mais novas de cada repositorio ficam (a ativa e dois rollbacks)', () => {
    const awk = /awk '([^']+)'/.exec(SONDA_DOCKER.split('echo ---;')[2])[1]
    const id = (c) => 'sha256:' + c.repeat(64)
    // A ativa e os dois rollbacks do historico de releases.
    const lista = [`servico-prod 622f01fe975d ${id('a')}`, `servico-prod da3181049f40 ${id('b')}`, `servico-prod 29e25477f481 ${id('c')}`].join('\n')
    const r = spawnSync('awk', [awk], { input: lista, encoding: 'utf8' })
    assert.equal(r.stdout.trim(), '')
  })
  test('cache de build grande logo depois de um deploy nao impede o fechamento', () => {
    assert.equal(lixoNoServidor(parseSonda('---\n0\n---\nBuild Cache|53.39GB\n')), false)
  })
  test('servidor limpo nao e lixo, mesmo com imagem de rollback recuperavel', () => {
    assert.equal(lixoNoServidor(parseSonda('---\n0\n---\nImages|1.2GB (10%)\nBuild Cache|0B\n')), false)
  })
  test('container parado que nao e de goal nunca e lixo nem sai no rm (pode ser app do usuario)', () => {
    const s = parseSonda('aidlc-agent-x\nplex\n---\n0\n---\nBuild Cache|0B\n')
    assert.equal(lixoNoServidor(s), false)
    const cmd = limpaDocker(['u12-carga-1', 'plex', 'unidade42-teste'])
    assert.match(cmd, /docker rm 'u12-carga-1' 'unidade42-teste'/)
    assert.doesNotMatch(cmd, /plex/)
    assert.doesNotMatch(cmd, /container prune|image prune -a/)
  })
  test('worktree prunable', () => {
    assert.equal(parseWorktrees('worktree /a\nHEAD 1\nbranch refs/heads/main\n\nworktree /b\nHEAD 2\ndetached\nprunable gitdir file points to non-existent location\n')[1].prunable, true)
  })
})

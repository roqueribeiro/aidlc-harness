#!/usr/bin/env node
/*
 * O trivy sob demanda: baixa uma vez, confere o sha256 e recusa o que não confere.
 * O servidor roda em outro processo: o download usa curl síncrono, que travaria um servidor no mesmo.
 */
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ATIVOS, VERSAO, pastaDeCache, resolverTrivy, tarDoSistema } from './trivy.mjs'

const windows = process.platform === 'win32'
const nome = windows ? 'trivy.exe' : 'trivy'
const chave = `${process.platform}-${process.arch}`
let pasta, servidor, base, pacote, hash

before(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'aidlc-trivy-'))
  const conteudo = join(pasta, 'conteudo')
  mkdirSync(conteudo)
  writeFileSync(join(conteudo, nome), '#!/bin/sh\necho trivy-falso\n')
  const arquivo = windows ? 'trivy.zip' : 'trivy.tar.gz'
  pacote = join(pasta, 'srv', `v${VERSAO}`, arquivo)
  mkdirSync(join(pasta, 'srv', `v${VERSAO}`), { recursive: true })
  execFileSync('tar', windows ? ['-a', '-cf', pacote, '-C', conteudo, nome] : ['-czf', pacote, '-C', conteudo, nome])
  hash = createHash('sha256').update(readFileSync(pacote)).digest('hex')
  const codigo = `const h=require('http'),f=require('fs'),p=require('path');const s=h.createServer((q,r)=>{const a=p.join(${JSON.stringify(join(pasta, 'srv'))},decodeURIComponent(q.url));if(!f.existsSync(a)){r.statusCode=404;return r.end()}r.end(f.readFileSync(a))});s.listen(0,'127.0.0.1',()=>console.log(s.address().port))`
  servidor = spawn(process.execPath, ['-e', codigo], { stdio: ['ignore', 'pipe', 'inherit'] })
  const porta = await new Promise((ok) => servidor.stdout.once('data', (d) => ok(String(d).trim())))
  base = `http://127.0.0.1:${porta}`
})
after(() => {
  servidor?.kill()
  rmSync(pasta, { recursive: true, force: true })
})

const semProxy = (home, extra = {}) => ({ HOME: home, USERPROFILE: home, LOCALAPPDATA: join(home, 'AppData'), PATH: '', NO_PROXY: '127.0.0.1', no_proxy: '127.0.0.1', SystemRoot: process.env.SystemRoot, ...extra })
const ativos = (sha) => ({ [chave]: { arquivo: windows ? 'trivy.zip' : 'trivy.tar.gz', sha256: sha } })

describe('trivy sob demanda', () => {
  test('a versão fixada tem hash para os cinco sistemas oficiais', () => {
    assert.deepEqual(Object.keys(ATIVOS).sort(), ['darwin-arm64', 'darwin-x64', 'linux-arm64', 'linux-x64', 'win32-x64'])
    for (const [k, a] of Object.entries(ATIVOS)) {
      assert.match(a.sha256, /^[0-9a-f]{64}$/, k)
      assert.ok(a.arquivo.includes(VERSAO), k)
    }
  })

  test('sem trivy em lugar nenhum: baixa, confere, extrai para o cache e na segunda vez não baixa', async () => {
    const home = mkdtempSync(join(tmpdir(), 'aidlc-trivy-home-'))
    const env = semProxy(home)
    const p = await resolverTrivy({ env, ativos: ativos(hash), base, versao: VERSAO })
    assert.equal(p, join(pastaDeCache(env), 'trivy', VERSAO, nome))
    assert.ok(existsSync(p))
    assert.deepEqual(readdirSync(join(pastaDeCache(env), 'trivy', VERSAO)), [nome], 'só o executável fica no cache')
    const p2 = await resolverTrivy({ env, ativos: ativos(hash), base: 'http://127.0.0.1:1', versao: VERSAO })
    assert.equal(p2, p, 'segunda vez sai do cache, sem rede')
    rmSync(home, { recursive: true, force: true })
  })

  test('mutante: sha256 diferente apaga o download e não deixa executável', async () => {
    const home = mkdtempSync(join(tmpdir(), 'aidlc-trivy-home-'))
    const env = semProxy(home)
    await assert.rejects(resolverTrivy({ env, ativos: ativos('0'.repeat(64)), base, versao: VERSAO }), /sha256 do trivy baixado nao confere/)
    const dir = join(pastaDeCache(env), 'trivy', VERSAO)
    assert.deepEqual(existsSync(dir) ? readdirSync(dir) : [], [])
    rmSync(home, { recursive: true, force: true })
  })

  test('download que falha vira erro, não "nada encontrado"', async () => {
    const home = mkdtempSync(join(tmpdir(), 'aidlc-trivy-home-'))
    await assert.rejects(resolverTrivy({ env: semProxy(home), ativos: ativos(hash), base: `${base}/nao-existe`, versao: VERSAO }))
    rmSync(home, { recursive: true, force: true })
  })

  test('o trivy do PATH vence o download, e AIDLC_TRIVY vence os dois', async () => {
    const home = mkdtempSync(join(tmpdir(), 'aidlc-trivy-home-'))
    const bin = join(home, 'bin')
    mkdirSync(bin)
    writeFileSync(join(bin, nome), '')
    if (!windows) chmodSync(join(bin, nome), 0o755)
    assert.equal(await resolverTrivy({ env: semProxy(home, { PATH: bin }), ativos: {}, base }), join(bin, nome))
    const proprio = join(home, 'meu-trivy')
    writeFileSync(proprio, '')
    assert.equal(await resolverTrivy({ env: semProxy(home, { PATH: bin, AIDLC_TRIVY: proprio }), ativos: {}, base }), proprio)
    await assert.rejects(resolverTrivy({ env: semProxy(home, { AIDLC_TRIVY: join(home, 'nao-ha') }) }), /AIDLC_TRIVY/)
    rmSync(home, { recursive: true, force: true })
  })

  test('sistema sem trivy oficial diz o que fazer em vez de falhar calado', async () => {
    const home = mkdtempSync(join(tmpdir(), 'aidlc-trivy-home-'))
    await assert.rejects(resolverTrivy({ env: semProxy(home), plataforma: 'freebsd', arq: 'x64' }), /instale o trivy/)
    rmSync(home, { recursive: true, force: true })
  })

  test('Windows usa o tar.exe do sistema, com SystemRoot em qualquer caixa (o Git Bash exporta SYSTEMROOT)', () => {
    assert.equal(tarDoSistema({ SystemRoot: 'C:\\Windows' }, 'win32'), join('C:\\Windows', 'System32', 'tar.exe'))
    assert.equal(tarDoSistema({ SYSTEMROOT: 'D:\\Win' }, 'win32'), join('D:\\Win', 'System32', 'tar.exe'))
    assert.equal(tarDoSistema({}, 'win32'), join('C:\\Windows', 'System32', 'tar.exe'))
    assert.equal(tarDoSistema({ SYSTEMROOT: 'x' }, 'linux'), 'tar')
  })
})

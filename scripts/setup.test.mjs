import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readlinkSync, lstatSync, existsSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { planejar, estado, dirPadrao, noPath, MARCADOR_CMD } from './setup.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'setup.mjs')
const rodar = (...a) => spawnSync(process.execPath, [SCRIPT, ...a], { encoding: 'utf8' })
const WIN = process.platform === 'win32'
// Os testes de symlink só fazem sentido onde o setup cria symlink; no Windows ele cria .cmd.
const soPosix = { skip: WIN && 'no Windows o setup cria .cmd, não symlink' }

describe('planejar', () => {
  const base = { tools: ['aidlc-gate', 'aidlc-init'], toolsDir: '/kit/tools', dir: '/bin' }
  test('POSIX: um symlink por executável', () => {
    const p = planejar({ ...base, plat: 'linux' })
    assert.deepEqual(p.map((x) => [x.tipo, x.destino, x.alvo]), [
      ['symlink', '/bin/aidlc-gate', '/kit/tools/aidlc-gate'],
      ['symlink', '/bin/aidlc-init', '/kit/tools/aidlc-init'],
    ])
  })
  test('Windows: um .cmd que chama node, com o marcador', () => {
    const [g] = planejar({ ...base, plat: 'win32' })
    assert.equal(g.tipo, 'cmd')
    assert.ok(g.destino.endsWith('aidlc-gate.cmd'))
    assert.ok(g.conteudo.includes(MARCADOR_CMD))
    assert.match(g.conteudo, /node ".*aidlc-gate" %\*/)
  })
  test('diretório padrão por plataforma', () => {
    assert.equal(dirPadrao('linux', '/h'), '/h/.local/bin')
    assert.equal(dirPadrao('win32', 'C:\\Users\\fulano'), 'C:\\Users\\fulano\\.aidlc\\bin', 'caminho do Windows, mesmo planejado no Linux')
  })
})

describe('estado', () => {
  const link = { tipo: 'symlink', alvo: '/kit/tools/aidlc-gate' }
  test('sem arquivo: falta', () => assert.equal(estado(link, { existe: false }), 'falta'))
  test('link para o alvo certo: ok', () => assert.equal(estado(link, { existe: true, ehLink: true, alvoDoLink: '/kit/tools/aidlc-gate' }), 'ok'))
  test('link para uma cópia antiga do kit: desatualizado', () =>
    assert.equal(estado(link, { existe: true, ehLink: true, alvoDoLink: '/velho/aidlc-harness/tools/aidlc-gate' }), 'desatualizado'))
  test('link para outra coisa: conflito, nunca sobrescreve', () =>
    assert.equal(estado(link, { existe: true, ehLink: true, alvoDoLink: '/usr/bin/outra-coisa' }), 'conflito'))
  test('arquivo comum com o mesmo nome: conflito', () => assert.equal(estado(link, { existe: true, ehLink: false }), 'conflito'))
  test('.cmd sem o marcador é de outra pessoa: conflito', () =>
    assert.equal(estado({ tipo: 'cmd', conteudo: 'x' }, { existe: true, conteudo: '@echo off\r\nfoo' }), 'conflito'))
})

describe('noPath', () => {
  test('acha e não acha', () => {
    assert.ok(noPath('/a/b', '/x:/a/b:/y', 'linux'))
    assert.ok(!noPath('/a/c', '/x:/a/b:/y', 'linux'))
  })
  test('Windows: separador ; e sem diferença de maiúscula', () => {
    assert.ok(noPath('C:\\Users\\fulano\\.aidlc\\bin', 'C:\\Windows;c:\\users\\fulano\\.aidlc\\bin', 'win32'))
    assert.ok(!noPath('C:\\Users\\fulano\\.aidlc\\bin', 'C:\\Windows', 'win32'))
  })
})

describe('instalação de verdade', () => {
  test('Windows: instala um .cmd que roda o executável de verdade', { skip: !WIN && 'só no Windows' }, () => {
    const d = join(mkdtempSync(join(tmpdir(), 'aidlc-setup-')), 'bin')
    const r1 = rodar('--dir', d)
    assert.equal(r1.status, 0, r1.stdout + r1.stderr)
    const cmd = join(d, 'aidlc-gate.cmd')
    assert.ok(readFileSync(cmd, 'utf8').includes(MARCADOR_CMD))
    const r = spawnSync(cmd, ['--list'], { encoding: 'utf8', shell: true })
    assert.equal(r.status, 0, r.stdout + r.stderr)
    assert.match(r.stdout, /node-yarn/)
    assert.equal(rodar('--check', '--dir', d).status, 0)
    assert.equal(rodar('--uninstall', '--dir', d).status, 0)
    assert.ok(!existsSync(cmd))
  })

  test('instala, repete sem mudar nada, confere e desinstala', soPosix, () => {
    const d = join(mkdtempSync(join(tmpdir(), 'aidlc-setup-')), 'bin')
    const r1 = rodar('--dir', d)
    assert.equal(r1.status, 0, r1.stdout + r1.stderr)
    const gate = join(d, 'aidlc-gate')
    assert.ok(lstatSync(gate).isSymbolicLink())
    assert.ok(readlinkSync(gate).endsWith('tools/aidlc-gate'))
    assert.ok(existsSync(readlinkSync(gate)))
    assert.doesNotMatch(rodar('--dir', d).stdout, /instalado/)
    assert.equal(rodar('--check', '--dir', d).status, 0)
    assert.equal(rodar('--uninstall', '--dir', d).status, 0)
    assert.ok(!existsSync(gate))
    assert.equal(rodar('--check', '--dir', d).status, 1)
  })

  test('não sobrescreve arquivo alheio e sai com erro', soPosix, () => {
    const d = join(mkdtempSync(join(tmpdir(), 'aidlc-setup-')), 'bin')
    rodar('--dir', d)
    const alvo = join(d, 'aidlc-doctor')
    rodar('--uninstall', '--dir', d)
    writeFileSync(alvo, 'meu script')
    const r = rodar('--dir', d)
    assert.equal(r.status, 1)
    assert.match(r.stdout, /conflito/)
    assert.equal(readFileSync(alvo, 'utf8'), 'meu script')
  })

  test('link que aponta para outra coisa não é tocado', soPosix, () => {
    const d = join(mkdtempSync(join(tmpdir(), 'aidlc-setup-')), 'bin')
    rodar('--dir', d)
    rodar('--uninstall', '--dir', d)
    symlinkSync('/usr/bin/env', join(d, 'aidlc-gate'))
    const r = rodar('--dir', d)
    assert.equal(r.status, 1)
    assert.equal(readlinkSync(join(d, 'aidlc-gate')), '/usr/bin/env')
  })

  test('link para uma cópia antiga do kit é atualizado', soPosix, () => {
    const d = join(mkdtempSync(join(tmpdir(), 'aidlc-setup-')), 'bin')
    rodar('--dir', d)
    rodar('--uninstall', '--dir', d)
    symlinkSync('/velho/aidlc-harness/tools/aidlc-gate', join(d, 'aidlc-gate'))
    const r = rodar('--dir', d)
    assert.equal(r.status, 0, r.stdout)
    assert.ok(readlinkSync(join(d, 'aidlc-gate')).endsWith('plugins/aidlc-harness/tools/aidlc-gate'))
  })
})

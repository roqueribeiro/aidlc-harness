#!/usr/bin/env node
/*
 * Testes das bibliotecas compartilhadas do kit.
 *
 * `scrub` e a ultima barreira antes de um texto sair da maquina, e os formatos de token sao
 * o que impede um vazamento de sobreviver ao texto. Os dois sao deterministicos e puros,
 * entao nao ha desculpa para nao estarem cobertos.
 *
 * Uso: node plugins/aidlc-harness/lib/lib.test.mjs
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { scrub, SECRET_SHAPES } from './scrub.mjs'
import { temQuickstart, imagensDoReadme, eImagem, capaDoReadme } from './readme-check.mjs'
import { detectTech } from './detect.mjs'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

describe('scrub', () => {
  test('texto sem segredo sai identico e sem hits', () => {
    const { text, hits } = scrub('gate verde, 38 testes passando')
    assert.equal(text, 'gate verde, 38 testes passando')
    assert.deepEqual(hits, [])
  })

  test('redige token do GitHub, chave da OpenAI e chave do Google', () => {
    const { text, hits } = scrub('a ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA b sk-AAAAAAAAAAAAAAAAAAAAAA c AIza' + 'A'.repeat(35))
    assert.equal(text.includes('ghp_'), false)
    assert.equal(text.includes('sk-A'), false)
    assert.equal(text.includes('AIza'), false)
    assert.deepEqual(hits.sort(), ['api-key', 'github-token', 'google-api-key'])
  })

  test('redige chave privada inteira, do BEGIN ao END', () => {
    const key = '-----BEGIN PRIVATE KEY-----\nMIIabc\nlinha2\n-----END PRIVATE KEY-----'
    const { text, hits } = scrub(`antes ${key} depois`)
    assert.equal(text, 'antes [REDIGIDO:private-key] depois')
    assert.deepEqual(hits, ['private-key'])
  })

  /*
   * Regex global carrega `lastIndex`. Sem o reset, a segunda chamada comeca no meio do
   * texto anterior e deixa passar o segredo que estava antes daquele ponto. Este teste
   * e a razao de o reset existir.
   */
  test('duas chamadas seguidas redigem as duas, nao so a primeira', () => {
    const alvo = 'ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    for (let i = 0; i < 5; i++) {
      const { text, hits } = scrub(`n${i} ${alvo}`)
      assert.equal(text.includes('ghp_'), false, `chamada ${i} deixou passar`)
      assert.deepEqual(hits, ['github-token'])
    }
  })

  test('varias ocorrencias do mesmo formato viram varios hits', () => {
    const { hits } = scrub('ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA e ghp_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')
    assert.deepEqual(hits, ['github-token', 'github-token'])
  })

  test('aceita entrada que nao e string sem quebrar', () => {
    assert.equal(scrub(42).text, '42')
    assert.equal(scrub(null).text, 'null')
    assert.equal(scrub(undefined).text, 'undefined')
  })

  test('toda shape tem flag global, senao so a primeira ocorrencia seria redigida', () => {
    for (const [rx, label] of SECRET_SHAPES) {
      assert.ok(rx.flags.includes('g'), `${label} sem flag global`)
    }
  })
})







describe('README diz como comecar (aidlc-doctor, readme-quickstart)', () => {
  test('aceita os titulos que o projeto usa, com ou sem acento e emoji', () => {
    for (const titulo of ['## Quickstart', '## 🚀 Quick Start', '## Começando', '## Comecando', '### Setup', '## Uso']) {
      assert.equal(temQuickstart(`# Repo\n\n${titulo}\n\nyarn dev\n`), true, titulo)
    }
  })

  test('aceita "Como começar", um falso negativo real', () => {
    assert.equal(temQuickstart('# PROJETO\n\n## Como começar\n'), true)
    assert.equal(temQuickstart('## Como comecar'), true)
  })

  test('aceita "Como rodar", titulo comum em README de app', () => {
    assert.equal(temQuickstart('# Farol\n\n## Pré-requisitos\n\n## Como rodar\n\n1. `yarn install`\n'), true)
    assert.equal(temQuickstart('# Xadrez\n\n## Como rodar o servidor\n'), true)
  })

  test('nao aceita README sem a secao, nem a palavra solta fora de um titulo', () => {
    assert.equal(temQuickstart('# Repo\n\n## Sobre\n\nComo começar: leia o codigo.\n'), false)
    assert.equal(temQuickstart('# Como começar'), false)
    assert.equal(temQuickstart(null), false)
  })
})


describe('README mostra o que o repo e (aidlc-doctor, readme-capa)', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(2048)])
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2048)])
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${'<rect/>'.repeat(40)}</svg>`)
  // Um arquivo com extensao de imagem mas conteudo que nao e imagem (6 bytes soltos).
  const quebrado = Buffer.from([0xb2, 0xf8, 0x31, 0x9a, 0x59, 0xec])

  test('acha as imagens locais do markdown e do <img>, na ordem, sem as de URL', () => {
    const readme = [
      '<img src="https://raw.githubusercontent.com/org/.github/main/banner.png">',
      '![Capa](public/capa.jpg)',
      '<p><img alt="x" src="./docs/tela.png?v=2"></p>',
      '![diagrama](docs/contrato.svg "o contrato")',
      '![remota](https://exemplo.com/a.png)',
    ].join('\n')
    assert.deepEqual(imagensDoReadme(readme), ['public/capa.jpg', 'docs/tela.png', 'docs/contrato.svg'])
    assert.deepEqual(imagensDoReadme(null), [])
  })

  test('confere os bytes: PNG, JPEG e SVG abrem; o arquivo de 6 bytes e o texto nao', () => {
    assert.equal(eImagem(png, 'a.png'), true)
    assert.equal(eImagem(jpeg, 'capa.jpg'), true)
    assert.equal(eImagem(svg, 'docs/contrato.svg'), true)
    assert.equal(eImagem(quebrado, 'docs/contrato.svg'), false)
    // Um SVG vazio abre, mas nao mostra nada: nao e capa.
    assert.equal(eImagem(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'vazio.svg'), false)
    assert.equal(eImagem(Buffer.from('nao sou imagem'.repeat(100)), 'a.png'), false)
    assert.equal(eImagem(Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'mini.png'), false)
    assert.equal(eImagem(null, 'a.png'), false)
  })

  test('a capa e a primeira imagem local que abre; sem nenhuma, reprova dizendo por que', () => {
    const arquivos = { 'docs/contrato.svg': quebrado, 'public/capa.jpg': jpeg }
    const ler = (c) => arquivos[c] ?? null
    assert.deepEqual(capaDoReadme('![x](docs/contrato.svg)\n![y](public/capa.jpg)', ler), {
      ok: true,
      imagem: 'public/capa.jpg',
    })
    assert.deepEqual(capaDoReadme('![x](docs/contrato.svg)', ler), {
      ok: false,
      motivo: 'docs/contrato.svg nao e imagem (6 bytes)',
    })
    assert.deepEqual(capaDoReadme('![x](docs/sumiu.png)', ler), { ok: false, motivo: 'docs/sumiu.png nao existe' })
    assert.equal(capaDoReadme('# Repo sem imagem\n', ler).ok, false)
    assert.equal(capaDoReadme('![so remota](https://exemplo.com/a.png)', ler).ok, false)
  })
})

/*
 * O aidlc-doctor liga o `readme-capa` nos repos de app, contra um repo de
 * verdade num diretorio temporario. A regra em si esta testada em lib.test.mjs; aqui se prova a
 * ligacao: o check aparece para app, reprova sem imagem, aprova com uma que abre, e nao
 * aparece para outra tecnologia.
 *
 * O git do repo temporario roda sem as variaveis GIT_* de quem chamou: dentro de um hook, o
 * GIT_DIR herdado faria o `git init` daqui escrever no repositorio do hook .
 */
const DOCTOR = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'aidlc-doctor')
const semGit = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))

function repo(arquivos) {
  const raiz = mkdtempSync(join(tmpdir(), 'doctor-capa-'))
  for (const [caminho, conteudo] of Object.entries(arquivos)) {
    mkdirSync(dirname(join(raiz, caminho)), { recursive: true })
    writeFileSync(join(raiz, caminho), conteudo)
  }
  spawnSync('git', ['init', '-q'], { cwd: raiz, env: semGit })
  return raiz
}

function capa(raiz) {
  const r = spawnSync(process.execPath, [DOCTOR, '--json', raiz], { encoding: 'utf8', env: semGit })
  const d = JSON.parse(r.stdout)
  return d.checks.find((c) => c.id === 'readme-capa') ?? null
}

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4096)])
const APP = { 'app.json': '{"id":"x"}', 'package.json': '{"name":"x"}' }


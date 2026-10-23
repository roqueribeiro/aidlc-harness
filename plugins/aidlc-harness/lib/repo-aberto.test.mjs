#!/usr/bin/env node
/*
 * Testes do perfil de repo aberto do aidlc-doctor.
 *
 * Uso: node plugins/aidlc-harness/lib/repo-aberto.test.mjs
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { licencaDoTexto, licencaAberta, temIngles, ciDeFork, dcoDeVerdade, exigeDco, checksDeRepoAberto } from './repo-aberto.mjs'

const MIT = 'MIT License\n\nCopyright (c) 2026 Fulano de Tal\n\nPermission is hereby granted, free of charge, to any person'
const APACHE = '                                 Apache License\n                           Version 2.0, January 2004'

describe('a licenca declarada', () => {
  test('reconhece MIT, Apache e AGPL pelo texto, e nada num arquivo proprietario', () => {
    assert.equal(licencaDoTexto(MIT), 'MIT')
    assert.equal(licencaDoTexto(APACHE), 'Apache-2.0')
    assert.equal(licencaDoTexto('GNU AFFERO GENERAL PUBLIC LICENSE\nVersion 3'), 'AGPL-3.0')
    assert.equal(licencaDoTexto('Todos os direitos reservados.'), null)
    assert.equal(licencaDoTexto(''), null)
  })

  test('sem LICENSE, vale o package.json; UNLICENSED nao e aberto', () => {
    assert.equal(licencaAberta({ licenseText: '', pkgLicense: 'MIT' }), 'MIT')
    assert.equal(licencaAberta({ licenseText: '', pkgLicense: 'UNLICENSED' }), null)
    assert.equal(licencaAberta({ licenseText: '', pkgLicense: null }), null)
  })
})

describe('ingles', () => {
  test('secao ou aviso em ingles conta; palavra solta nao', () => {
    assert.ok(temIngles('# Como contribuir\n\n_English below._\n'))
    assert.ok(temIngles('## English\n\nHow it works'))
    assert.ok(temIngles('## How to contribute'))
    assert.ok(!temIngles('# Calculadora\n\nFunciona no English Pub da esquina.'))
  })

  test('README escrito em inglês do começo ao fim conta; português com comando em inglês não', () => {
    const ingles =
      'Exemplo Server is the backend that turns any machine into a home lab. It runs in Docker, ' +
      'and you can install it with one command. The server is the part that talks to your disks, ' +
      'your containers and the AI agent, and it is what the desktop connects to when you use it ' +
      'from the browser. This guide shows how to run it, how to update it and how to contribute ' +
      'to it, from the first clone to the pull request that is merged.'
    assert.ok(temIngles(ingles))
    const portugues =
      'O servidor roda no Docker e você instala com um comando só. Ele conversa com os discos e ' +
      'os containers.\n\n```bash\n' +
      '# the script reads the file and writes to the disk with the key of the user\n'.repeat(4) +
      'curl -fsSL https://exemplo.com/install.sh | bash -s -- --update -y\n```\n'
    assert.ok(!temIngles(portugues))
  })
})

describe('CI de fork', () => {
  test('pull_request sem segredo passa', () => {
    const r = ciDeFork([{ nome: 'ci.yml', texto: 'on:\n  pull_request:\n  push:\njobs:\n  v:\n    runs-on: ubuntu-latest' }])
    assert.equal(r.ok, true)
  })
  test('pull_request_target reprova, mesmo com outro workflow bom', () => {
    const r = ciDeFork([
      { nome: 'ci.yml', texto: 'on: [pull_request]\njobs:\n  v:\n    runs-on: x' },
      { nome: 'label.yml', texto: 'on:\n  pull_request_target:' },
    ])
    assert.equal(r.ok, false)
    assert.deepEqual(r.perigosos.map((w) => w.nome), ['label.yml'])
  })
  test('comentario que explica o pull_request_target nao reprova', () => {
    const texto =
      '# NUNCA em pull_request_target, que daria token ao fork\non:\n  pull_request:  # do fork\njobs:\n  v:\n    runs-on: ubuntu-latest'
    assert.equal(ciDeFork([{ nome: 'ci.yml', texto }]).ok, true)
  })
  test('segredo só no job de publicar, preso ao workflow_dispatch, não atrapalha o fork', () => {
    const texto = [
      'on:',
      '  pull_request:',
      '  workflow_dispatch:',
      'jobs:',
      '  testes:',
      '    runs-on: x',
      '    steps:',
      '      - run: yarn test',
      '  publicar:',
      "    if: github.event_name == 'workflow_dispatch'",
      '    steps:',
      '      - with:',
      '          password: ${{ secrets.DOCKERHUB_TOKEN }}',
    ].join('\n')
    assert.equal(ciDeFork([{ nome: 'ci.yml', texto }]).ok, true)
  })
  test('um CI de fork basta; a esteira que pede segredo no PR vira nota, não reprovação', () => {
    const ci = { nome: 'ci.yml', texto: 'on: [pull_request]\njobs:\n  v:\n    runs-on: x' }
    const esteira = { nome: 'aidlc.yml', texto: 'on: [pull_request]\njobs:\n  g:\n    env:\n      T: ${{ secrets.HARNESS_TOKEN }}' }
    const r = ciDeFork([ci, esteira])
    assert.equal(r.ok, true)
    assert.deepEqual(r.comSegredoNoPr.map((w) => w.nome), ['aidlc.yml'])
    assert.equal(ciDeFork([esteira]).ok, false, 'só a esteira com segredo não é CI de fork')
  })
  test('segredo em workflow de PR reprova; so push nao conta como CI de PR', () => {
    assert.equal(ciDeFork([{ nome: 'a.yml', texto: 'on: [pull_request]\n  env:\n    T: ${{ secrets.TOKEN }}' }]).ok, false)
    assert.equal(ciDeFork([{ nome: 'a.yml', texto: 'on: [push]' }]).ok, false)
  })
})

describe('DCO', () => {
  test('exige o CONTRIBUTING e o workflow que confere o Signed-off-by', () => {
    const wf = [{ nome: 'dco.yml', texto: 'on: [pull_request]\nrun: git log | grep "Signed-off-by"' }]
    assert.ok(dcoDeVerdade({ contributing: '## DCO\nAssine com git commit -s', workflows: wf }))
    assert.ok(!dcoDeVerdade({ contributing: '## DCO', workflows: [] }))
    assert.ok(!dcoDeVerdade({ contributing: 'nada', workflows: wf }))
  })
  test('o DCO é opt-in, declarado pelo projeto', () => {
    assert.ok(exigeDco({ dco: true }))
    assert.ok(!exigeDco({ dco: false }))
    assert.ok(!exigeDco({}))
    assert.ok(!exigeDco(undefined))
  })
})

/** Um repo de mentira, com os arquivos dados. */
const repo = (arquivos, { dco = false, pkgLicense = 'MIT' } = {}) => ({
  has: (rel) => rel in arquivos || Object.keys(arquivos).some((k) => k.startsWith(rel + '/')),
  read: (rel) => arquivos[rel] ?? '',
  workflows: Object.entries(arquivos)
    .filter(([k]) => k.startsWith('.github/workflows/'))
    .map(([k, texto]) => ({ nome: k.split('/').pop(), texto })),
  dco,
  pkgLicense,
})

describe('os itens do perfil', () => {
  test('repo fechado fica fora do perfil: nem ganha, nem perde', () => {
    const r = checksDeRepoAberto(repo({ 'README.md': '# Front' }, { pkgLicense: null }))
    assert.equal(r.licenca, null)
    assert.deepEqual(r.checks, [])
  })

  test('repo aberto completo passa em tudo, e o DCO so entra quando o projeto declara', () => {
    const arquivos = {
      LICENSE: MIT,
      'README.md': '# Exemplo\n\n## English\n',
      'CONTRIBUTING.md': '# Como contribuir\n\n_English below._\n\n## DCO\nSigned-off-by',
      'SECURITY.md': 'x',
      'CODE_OF_CONDUCT.md': 'x',
      '.github/ISSUE_TEMPLATE/bug.yml': 'x',
      '.github/pull_request_template.md': 'x',
      '.github/CODEOWNERS': '* @SEU-USUARIO',
      '.github/workflows/ci.yml': 'on: [pull_request, push]\njobs:\n  v:\n    runs-on: x',
      '.github/workflows/dco.yml': 'on: [pull_request]\n# confere Signed-off-by',
      'public/capa.png': 'x',
      'ASSETS.md': 'x',
    }
    const semDco = checksDeRepoAberto(repo(arquivos))
    assert.equal(semDco.licenca, 'MIT')
    assert.deepEqual(semDco.checks.filter((k) => !k.ok).map((k) => k.id), [])
    assert.ok(!semDco.checks.some((k) => k.id === 'aberto-dco'))
    const app = checksDeRepoAberto(repo(arquivos, { dco: true }))
    assert.deepEqual(app.checks.filter((k) => !k.ok).map((k) => k.id), [])
    assert.ok(app.checks.some((k) => k.id === 'aberto-dco'))
  })

  test('cada falta aparece pelo nome', () => {
    const r = checksDeRepoAberto(repo({ LICENSE: MIT, 'README.md': '# x', 'public/a.png': 'x' }, { pkgLicense: 'Apache-2.0', dco: true }))
    assert.deepEqual(
      r.checks.filter((k) => !k.ok).map((k) => k.id).sort(),
      ['aberto-assets', 'aberto-ci-fork', 'aberto-codeowners', 'aberto-conduta', 'aberto-contributing', 'aberto-dco', 'aberto-licenca', 'aberto-modelos', 'aberto-readme-en', 'aberto-security'],
    )
  })
})

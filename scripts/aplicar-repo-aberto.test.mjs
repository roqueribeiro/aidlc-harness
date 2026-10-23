// Testes do aplicar-repo-aberto : o que ele escreve, o que ele não toca, e que o
// resultado passa no perfil de repo aberto do doctor.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { donoDoRemoto, preencher, planejar, settingsDoRepo } from './aplicar-repo-aberto.mjs'
import { checksDeRepoAberto } from '../plugins/aidlc-harness/lib/repo-aberto.mjs'

const TEMPLATES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'aidlc-harness', 'templates')
const listar = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? listar(p, base) : [path.relative(base, p).split(path.sep).join('/')]
  })
const lerTemplate = (rel) => fs.readFileSync(path.join(TEMPLATES, rel), 'utf8')
const ABERTOS = listar(path.join(TEMPLATES, 'aberto'))

describe('o remoto e os marcadores', () => {
  test('acha org e repo em https e em ssh', () => {
    assert.deepEqual(donoDoRemoto('https://github.com/org-exemplo/app-exemplo.git'), { org: 'org-exemplo', repo: 'app-exemplo' })
    assert.deepEqual(donoDoRemoto('git@github.com:org-exemplo/calculadora.git'), { org: 'org-exemplo', repo: 'calculadora' })
    assert.equal(donoDoRemoto('https://gitlab.com/x/y.git'), null)
  })

  test('preenche org, repo e gate, e a linha do DCO só entra com DCO', () => {
    const t = 'a {{ORG}}/{{REPO}} `{{GATE}}`\n{{DCO_ITEM}}\nfim'
    const sem = preencher(t, { org: 'o', repo: 'r', gate: 'yarn v', dco: false })
    assert.equal(sem, 'a o/r `yarn v`\nfim')
    assert.match(preencher(t, { org: 'o', repo: 'r', gate: 'g', dco: true }), /Signed-off-by/)
  })
})

describe('o plano', () => {
  const base = {
    lerTemplate,
    templates: ABERTOS,
    origin: 'https://github.com/org-exemplo/app-exemplo.git',
    scripts: { verificar: 'x', dev: 'vite', test: 'vitest run' },
  }

  test('nunca sobrescreve: o que existe entra em "pulados"', () => {
    const p = planejar({ ...base, existe: (rel) => rel === 'CODE_OF_CONDUCT.md', opcoes: {} })
    assert.ok(p.pulados.includes('CODE_OF_CONDUCT.md (já existe)'))
    assert.ok(!p.escrever.some((e) => e.destino === 'CODE_OF_CONDUCT.md'))
  })

  test('repo com modelos de issue próprios não ganha outro par', () => {
    const p = planejar({ ...base, existe: () => false, opcoes: {}, modelosDeIssue: ['bug_report.md'] })
    assert.ok(!p.escrever.some((e) => /ISSUE_TEMPLATE\/(bug|ideia)/.test(e.destino)))
    assert.ok(p.escrever.some((e) => e.destino === '.github/ISSUE_TEMPLATE/config.yml'))
  })

  test('o DCO só entra com a opção, e sai do caminho dco/', () => {
    const sem = planejar({ ...base, existe: () => false, opcoes: {} })
    assert.ok(!sem.escrever.some((e) => /dco/.test(e.destino)))
    const com = planejar({ ...base, existe: () => false, opcoes: { dco: true } })
    assert.ok(com.escrever.some((e) => e.destino === '.github/workflows/dco.yml'))
  })

  test('com --harness, o settings liga o plugin e libera os scripts que o repo tem', () => {
    const p = planejar({ ...base, existe: () => false, opcoes: { harness: true, loop: 'generico' } })
    const s = JSON.parse(p.escrever.find((e) => e.destino === '.claude/settings.json').conteudo)
    assert.equal(s.enabledPlugins['aidlc-harness@aidlc'], true)
    assert.ok(s.extraKnownMarketplaces.aidlc)
    assert.ok(s.permissions.allow.includes('Bash(yarn verificar*)'))
    assert.ok(!s.permissions.allow.includes('Bash(yarn build*)'), 'script que o repo não tem não entra')
    assert.ok(p.escrever.some((e) => e.destino === '.claude/loop.md'))
  })

  test('repo fechado ganha só o harness, pelo mesmo critério de licença do doctor', () => {
    const p = planejar({ ...base, existe: () => false, opcoes: { harness: true, loop: 'generico' }, licenca: null })
    assert.deepEqual(p.escrever.map((e) => e.destino).sort(), ['.claude/loop.md', '.claude/settings.json'])
    assert.ok(p.pulados.some((x) => /licença aberta/.test(x)))
    const aberto = planejar({ ...base, existe: () => false, opcoes: {}, licenca: 'MIT' })
    assert.ok(aberto.escrever.some((e) => e.destino === 'CODE_OF_CONDUCT.md'))
  })

  test('settings: a allowlist da stack entra antes do git, sem repetir', () => {
    const s = JSON.parse(settingsDoRepo(lerTemplate('settings.json.template'), { verificar: 'x' }))
    const i = s.permissions.allow.indexOf('Bash(yarn verificar*)')
    assert.ok(i >= 0 && i < s.permissions.allow.indexOf('Bash(git status*)'))
  })
})

describe('o resultado passa no perfil de repo aberto do doctor', () => {
  test('um repo com licença, README, CONTRIBUTING, SECURITY e CI fica completo', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aberto-'))
    const arquivos = {
      LICENSE: 'MIT License\n\nPermission is hereby granted, free of charge, to any person',
      'README.md': '# Calculadora\n\n## English\n',
      'CONTRIBUTING.md': '# Como contribuir\n\n_English below._\n\n## DCO\nUse git commit -s (Signed-off-by).',
      'SECURITY.md': 'x',
      '.github/workflows/ci.yml': 'on:\n  pull_request:\n  push:\njobs:\n  v:\n    runs-on: ubuntu-latest',
    }
    for (const [rel, t] of Object.entries(arquivos)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
      fs.writeFileSync(path.join(dir, rel), t)
    }
    const origin = 'git@github.com:org-exemplo/calculadora.git'
    const plano = planejar({
      lerTemplate,
      templates: ABERTOS,
      origin,
      scripts: {},
      existe: (rel) => fs.existsSync(path.join(dir, rel)),
      opcoes: { dco: true },
    })
    for (const { destino, conteudo } of plano.escrever) {
      fs.mkdirSync(path.dirname(path.join(dir, destino)), { recursive: true })
      fs.writeFileSync(path.join(dir, destino), conteudo)
    }
    const has = (rel) => fs.existsSync(path.join(dir, rel))
    const read = (rel) => (has(rel) && fs.statSync(path.join(dir, rel)).isFile() ? fs.readFileSync(path.join(dir, rel), 'utf8') : '')
    const workflows = fs
      .readdirSync(path.join(dir, '.github/workflows'))
      .map((nome) => ({ nome, texto: read(`.github/workflows/${nome}`) }))
    const r = checksDeRepoAberto({ has, read, workflows, dco: true, pkgLicense: 'MIT' })
    assert.deepEqual(r.checks.filter((k) => !k.ok).map((k) => k.id), [])
    assert.ok(r.checks.some((k) => k.id === 'aberto-dco'))
    fs.rmSync(dir, { recursive: true, force: true })
  })
})

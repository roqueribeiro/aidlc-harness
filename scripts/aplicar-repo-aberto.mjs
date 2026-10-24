#!/usr/bin/env node
/*
 * Escreve num repo o que o perfil de repo aberto do aidlc-doctor cobra e ainda falta
 * código de conduta, modelos de issue e de PR, CODEOWNERS e, com --dco, o workflow
 * de DCO. Com --harness, também o .claude/ do repo (o plugin
 * ligado, a allowlist da stack e o loop.md).
 *
 * NUNCA sobrescreve. Arquivo que existe fica como está, e a saída diz que pulou: o repo
 * pode ter a versão dele por um motivo que este script não conhece. O que decide se ficou
 * bom é o `aidlc-doctor` depois, não este script.
 *
 *   node scripts/aplicar-repo-aberto.mjs ../app-exemplo --gate "yarn verificar" --harness --loop generico
 *   node scripts/aplicar-repo-aberto.mjs ../calculadora --gate "yarn verificar" --dco
 *   node scripts/aplicar-repo-aberto.mjs ../app-exemplo --seco        # só mostra
 *   node scripts/aplicar-repo-aberto.mjs ../app-fechado --harness --loop generico   # fechado: só o .claude/
 *
 * Repo sem licença aberta (o `licencaAberta` do doctor decide, pelo LICENSE e pelo
 * package.json) não recebe os modelos de quem contribui de fora, só o harness.
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { licencaAberta } from '../plugins/aidlc-harness/lib/repo-aberto.mjs'

const KIT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'plugins', 'aidlc-harness')
const ABERTO = path.join(KIT, 'templates', 'aberto')

const listar = (dir, base = dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? listar(p, base) : [path.relative(base, p).split(path.sep).join('/')]
  })

/** A organização e o repo pelo remoto, em https ou ssh. */
export function donoDoRemoto(origin) {
  const m = String(origin || '').match(/github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?\/?$/)
  return m ? { org: m[1], repo: m[2] } : null
}

const LINHA_DCO =
  '- [ ] Todo commit tem `Signed-off-by` (`git commit -s`), pelo DCO do CONTRIBUTING. / Every commit is signed off (`git commit -s`), per the DCO in CONTRIBUTING.'

/** Troca os marcadores do template. Linha que fica só com marcador vazio some. */
export function preencher(texto, { org, repo, gate, dco }) {
  return texto
    .replaceAll('{{ORG}}', org)
    .replaceAll('{{REPO}}', repo)
    .replaceAll('{{GATE}}', gate)
    .replace(/^\{\{DCO_ITEM\}\}\n?/m, dco ? `${LINHA_DCO}\n` : '')
}

/** O .claude/settings.json da organização, com a allowlist dos scripts que o repo tem. */
export function settingsDoRepo(template, scripts) {
  const cfg = JSON.parse(template)
  const daStack = ['verificar', 'test', 'lint', 'dev', 'build']
    .filter((s) => scripts[s])
    .map((s) => `Bash(yarn ${s}*)`)
  const allow = cfg.permissions.allow
  const pos = allow.findIndex((a) => a.startsWith('Bash(git '))
  allow.splice(pos < 0 ? allow.length : pos, 0, ...daStack.filter((a) => !allow.includes(a)))
  delete cfg.$comment
  cfg.$comment =
    'Quem registra o marketplace de verdade e o `claude plugin marketplace add`, uma vez por maquina; veja docs/GETTING-STARTED.md.'
  return JSON.stringify(cfg, null, 2) + '\n'
}

/**
 * O plano: o que escrever e o que pular. Puro, para o teste.
 * `existe(rel)`, `ler(rel)` e `origin` descrevem o repo alvo.
 */
export function planejar({ existe, lerTemplate, templates, origin, scripts, opcoes, modelosDeIssue = [], licenca = 'MIT' }) {
  const dono = donoDoRemoto(origin)
  if (!dono) throw new Error(`remoto "${origin}" não é do GitHub: não dá para preencher org e repo`)
  const valores = { ...dono, gate: opcoes.gate || 'yarn verificar', dco: Boolean(opcoes.dco) }
  const escrever = []
  const pulados = []
  // Repo fechado não é cobrado pelo perfil de repo aberto do doctor, e o mesmo critério
  // decide aqui: sem licença aberta, os modelos de quem contribui de fora não entram.
  // Só o harness (--harness) faz sentido nele.
  if (!licenca) pulados.push('modelos de repo aberto (o repo não declara licença aberta)')
  for (const t of licenca ? templates : []) {
    if (t.startsWith('dco/') && !opcoes.dco) continue
    const destino = t.replace(/^dco\//, '')
    // Repo que já tem os modelos de issue dele (o server tem bug_report.md e
    // feature_request.md) não ganha outro par: dois "reportar bug" confundem quem chega.
    const ehModelo = /^\.github\/ISSUE_TEMPLATE\/(?!config\.yml$)/.test(destino)
    if (ehModelo && modelosDeIssue.length) pulados.push(`${destino} (o repo já tem ${modelosDeIssue.join(', ')})`)
    else if (existe(destino)) pulados.push(`${destino} (já existe)`)
    else escrever.push({ destino, conteudo: preencher(lerTemplate(`aberto/${t}`), valores) })
  }
  if (opcoes.harness) {
    const s = '.claude/settings.json'
    if (existe(s)) pulados.push(`${s} (já existe)`)
    else escrever.push({ destino: s, conteudo: settingsDoRepo(lerTemplate('settings.json.template'), scripts) })
    const l = '.claude/loop.md'
    if (existe(l)) pulados.push(`${l} (já existe)`)
    else if (opcoes.loop) escrever.push({ destino: l, conteudo: lerTemplate(`loop/${opcoes.loop}.md`) })
  }
  return { ...dono, escrever, pulados }
}

function main() {
  const argv = process.argv.slice(2)
  const alvo = argv.find((a) => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--gate' && argv[argv.indexOf(a) - 1] !== '--loop')
  if (!alvo) {
    console.error('uso: node scripts/aplicar-repo-aberto.mjs <repo> [--gate "cmd"] [--dco] [--harness] [--loop <stack>] [--seco]')
    process.exit(2)
  }
  const valor = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : null)
  const raiz = path.resolve(alvo)
  const origin = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: raiz, encoding: 'utf8' }).stdout.trim()
  const pkg = fs.existsSync(path.join(raiz, 'package.json'))
    ? JSON.parse(fs.readFileSync(path.join(raiz, 'package.json'), 'utf8'))
    : {}
  const plano = planejar({
    existe: (rel) => fs.existsSync(path.join(raiz, rel)),
    lerTemplate: (rel) => fs.readFileSync(path.join(KIT, 'templates', rel), 'utf8'),
    templates: listar(ABERTO),
    origin,
    scripts: pkg.scripts || {},
    opcoes: { gate: valor('--gate'), dco: argv.includes('--dco'), harness: argv.includes('--harness'), loop: valor('--loop') },
    modelosDeIssue: fs.existsSync(path.join(raiz, '.github/ISSUE_TEMPLATE'))
      ? fs.readdirSync(path.join(raiz, '.github/ISSUE_TEMPLATE')).filter((f) => /\.(md|ya?ml)$/.test(f) && f !== 'config.yml')
      : [],
    licenca: licencaAberta({
      licenseText: fs.existsSync(path.join(raiz, 'LICENSE')) ? fs.readFileSync(path.join(raiz, 'LICENSE'), 'utf8') : '',
      pkgLicense: pkg.license,
    }),
  })
  const seco = argv.includes('--seco')
  for (const { destino, conteudo } of plano.escrever) {
    if (!seco) {
      fs.mkdirSync(path.dirname(path.join(raiz, destino)), { recursive: true })
      fs.writeFileSync(path.join(raiz, destino), conteudo)
    }
    console.log(`${seco ? 'escreveria' : 'escreveu'}  ${destino}`)
  }
  for (const p of plano.pulados) console.log(`pulou      ${p}`)
  console.log(`${plano.org}/${plano.repo}: ${plano.escrever.length} arquivo(s), ${plano.pulados.length} já existia(m)`)
}

// Pelo caminho real dos dois lados: no macOS o /tmp é link para /private/tmp, e a
// comparação de texto pura fazia o script sair calado, sem escrever nada, quando rodado
// de um worktree em /tmp (acontece ao rodar de um worktree).
const chamadoDireto = () => {
  try {
    return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(process.argv[1])
  } catch {
    return false
  }
}
if (chamadoDireto()) main()

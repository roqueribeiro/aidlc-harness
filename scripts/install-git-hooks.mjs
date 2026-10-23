#!/usr/bin/env node
/*
 * Instala o gancho de pre-push que roda o gate na máquina antes do push sair.
 *
 *   node scripts/install-git-hooks.mjs [pasta ...]          # padrão: a pasta atual
 *   node scripts/install-git-hooks.mjs --check [pasta ...]  # só reporta, exit 1 se faltar
 *
 * Por que existe: .git/hooks/ não é versionado. O gancho some em toda formatação, todo clone
 * novo e toda máquina nova, calado. O aidlc-doctor mede a ausência (gate-local), e este script
 * é o conserto.
 *
 * Regras:
 *  - nunca sobrescreve um pre-push que não seja o nosso (marcador abaixo): avisa e sai com erro;
 *  - respeita core.hooksPath e husky (.husky/pre-push), que o git consulta antes de .git/hooks/;
 *  - o gancho chama `aidlc-gate`. Se a ferramenta não estiver no PATH, o gancho avisa e deixa o
 *    push passar, para não travar quem ainda não instalou o kit (o CI do projeto é a segunda barreira).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

export const MARCADOR = '# aidlc-harness: pre-push'

export const CONTEUDO = `#!/bin/sh
${MARCADOR}
if ! command -v aidlc-gate >/dev/null 2>&1; then
  echo "aidlc-harness: aidlc-gate não está no PATH, pulando o gate local (rode scripts/setup para instalar)" >&2
  exit 0
fi
exec aidlc-gate
`

/** Onde o git procura o pre-push deste repositório, na ordem em que ele consulta. */
export function destinoDoGancho(raiz) {
  const r = spawnSync('git', ['config', '--get', 'core.hooksPath'], { cwd: raiz, encoding: 'utf8' })
  const hooksPath = r.status === 0 ? r.stdout.trim() : ''
  if (hooksPath && !hooksPath.includes('.husky/_')) return resolve(raiz, hooksPath, 'pre-push')
  if (existsSync(join(raiz, '.husky'))) return join(raiz, '.husky', 'pre-push')
  return join(raiz, '.git', 'hooks', 'pre-push')
}

/** Decide o que fazer, sem tocar no disco: 'instalar' | 'ja-instalado' | 'conflito'. */
export function decidir(atual) {
  if (atual == null) return 'instalar'
  if (atual.includes(MARCADOR)) return atual === CONTEUDO ? 'ja-instalado' : 'instalar'
  return 'conflito'
}

function aplicar(raiz, so) {
  if (!existsSync(join(raiz, '.git'))) return { raiz, estado: 'nao-e-repo' }
  const destino = destinoDoGancho(raiz)
  const atual = existsSync(destino) ? readFileSync(destino, 'utf8') : null
  const acao = decidir(atual)
  if (acao === 'conflito') return { raiz, destino, estado: 'conflito' }
  if (acao === 'ja-instalado') return { raiz, destino, estado: 'ok' }
  if (so) return { raiz, destino, estado: 'falta' }
  mkdirSync(join(destino, '..'), { recursive: true })
  writeFileSync(destino, CONTEUDO)
  chmodSync(destino, 0o755)
  return { raiz, destino, estado: 'instalado' }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const so = args.includes('--check')
  const pastas = args.filter((a) => !a.startsWith('--'))
  const alvos = (pastas.length ? pastas : ['.']).map((p) => resolve(p))
  let falhou = false
  for (const raiz of alvos) {
    const r = aplicar(raiz, so)
    const rotulo = { ok: 'ok         ', instalado: 'instalado  ', falta: 'FALTA      ', conflito: 'CONFLITO   ', 'nao-e-repo': 'não é repo ' }[r.estado]
    console.log(`${rotulo} ${raiz}${r.destino ? `  (${r.destino})` : ''}`)
    if (r.estado === 'conflito') console.log('           já existe um pre-push que não é do kit; incorpore a chamada a `aidlc-gate` nele à mão.')
    if (['falta', 'conflito', 'nao-e-repo'].includes(r.estado)) falhou = true
  }
  process.exit(falhou ? 1 : 0)
}

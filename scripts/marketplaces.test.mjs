#!/usr/bin/env node
/*
 * O repositório é marketplace de duas ferramentas: Claude Code (.claude-plugin/marketplace.json) e
 * Codex (.agents/plugins/marketplace.json), apontando para o mesmo plugin. O que precisa valer:
 * os dois apontam para uma pasta que existe, o nome e a versão batem, e o Codex não descobre o
 * hooks/hooks.json do Claude (formato e variáveis diferentes: no Codex os hooks vêm do
 * .codex/hooks.json que o aidlc-init grava no projeto).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const ler = (p) => JSON.parse(readFileSync(join(RAIZ, p), 'utf8'))

export function conferirMarketplaces({ claude, codex, manifestoClaude, manifestoPortatil, existe }) {
  const erros = []
  const pc = claude.plugins?.find((p) => p.name === 'aidlc-harness')
  const px = codex.plugins?.find((p) => p.name === 'aidlc-harness')
  if (!pc) erros.push('marketplace do Claude sem aidlc-harness')
  if (!px) erros.push('marketplace do Codex sem aidlc-harness')
  if (pc && !existe(pc.source)) erros.push(`marketplace do Claude aponta para ${pc.source}, que nao existe`)
  if (px && !(px.source?.source === 'local' && existe(px.source.path))) erros.push('marketplace do Codex aponta para pasta que nao existe')
  if (px && (!px.policy?.installation || !px.policy?.authentication || !px.category)) erros.push('entrada do Codex sem policy ou category')
  if (manifestoPortatil.name !== manifestoClaude.name) erros.push('nome do plugin diverge entre Claude e Codex')
  if (manifestoPortatil.version !== manifestoClaude.version) erros.push('versao do plugin diverge entre Claude e Codex')
  const hooks = manifestoPortatil.extensions?.['com.openai']?.hooks
  if (!Array.isArray(hooks) || hooks.length !== 0) erros.push('o Codex descobriria o hooks/hooks.json do Claude: declare extensions["com.openai"].hooks = []')
  return erros
}

const real = () => ({
  claude: ler('.claude-plugin/marketplace.json'),
  codex: ler('.agents/plugins/marketplace.json'),
  manifestoClaude: ler('plugins/aidlc-harness/.claude-plugin/plugin.json'),
  manifestoPortatil: ler('plugins/aidlc-harness/plugin.json'),
  existe: (p) => existsSync(join(RAIZ, p)),
})

test('os dois marketplaces do repositório fecham', () => {
  assert.deepEqual(conferirMarketplaces(real()), [])
})

test('mutantes: cada divergência reprova', () => {
  const r = real()
  const casos = [
    ['hooks do Claude descobertos pelo Codex', { ...r, manifestoPortatil: { ...r.manifestoPortatil, extensions: {} } }, /hooks\.json do Claude/],
    ['versão do Codex atrás', { ...r, manifestoPortatil: { ...r.manifestoPortatil, version: '0.0.1' } }, /versao/],
    ['caminho do Codex errado', { ...r, codex: { plugins: [{ ...r.codex.plugins[0], source: { source: 'local', path: './nao-existe' } }] } }, /Codex aponta/],
    ['Claude sem o plugin', { ...r, claude: { plugins: [] } }, /Claude sem/],
    ['Codex sem policy', { ...r, codex: { plugins: [{ ...r.codex.plugins[0], policy: undefined }] } }, /policy/],
  ]
  for (const [nome, entrada, rx] of casos) assert.ok(conferirMarketplaces(entrada).some((e) => rx.test(e)), nome)
})

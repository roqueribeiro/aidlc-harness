#!/usr/bin/env node
/*
 * gerar-prompts: gera docs/PROMPTS.md a partir dos comandos do plugin.
 *
 *   node scripts/gerar-prompts.mjs           # regrava docs/PROMPTS.md
 *   node scripts/gerar-prompts.mjs --check   # exit 1 se o arquivo divergir dos comandos
 *
 * Por que existe: Kiro e Copilot não carregam os comandos do plugin (`/inception`, `/construction`),
 * então a equipe cola o mesmo texto no chat. Texto copiado à mão diverge em silêncio; este script é o
 * mecanismo que impede: a fonte é `commands/*.md`, e o CI roda o `--check`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const COMANDOS = [
  { arquivo: 'inception.md', ancora: 'inception', titulo: 'Inception', exemplo: 'Quero um cadastro de clientes com busca e histórico de alterações' },
  { arquivo: 'construction.md', ancora: 'construction', titulo: 'Construction', exemplo: 'U1' },
]

/** Separa o front matter do corpo. */
export function corpoDoComando(texto) {
  const m = texto.match(/^---\n[\s\S]*?\n---\n+([\s\S]*)$/)
  return (m ? m[1] : texto).trim()
}

/** O corpo pronto para colar: o argumento do comando vira um texto de exemplo entre colchetes. */
export function paraColar(corpo, exemplo) {
  return corpo.replaceAll('$ARGUMENTS', `[${exemplo}]`)
}

export function gerar(leitor) {
  const partes = [
    '# Prompts para Kiro e GitHub Copilot',
    '',
    '> **Arquivo gerado.** A fonte são os comandos em `plugins/aidlc-harness/commands/`. Não edite aqui: edite o comando e rode `node scripts/gerar-prompts.mjs`. O CI confere com `--check`.',
    '',
    'No Claude Code, estes textos são os comandos `/aidlc-harness:inception` e `/aidlc-harness:construction`. Em Kiro e Copilot, que não carregam o plugin, cole o texto abaixo no chat do agente, trocando o trecho entre colchetes pelo seu pedido.',
    '',
  ]
  for (const c of COMANDOS) {
    const corpo = corpoDoComando(leitor(c.arquivo))
    partes.push(`## ${c.titulo}`, '', '````text', paraColar(corpo, c.exemplo), '````', '')
  }
  return partes.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const leitor = (arq) => readFileSync(join(RAIZ, 'plugins', 'aidlc-harness', 'commands', arq), 'utf8')
  const destino = join(RAIZ, 'docs', 'PROMPTS.md')
  const novo = gerar(leitor)
  if (process.argv.includes('--check')) {
    let atual = ''
    try {
      atual = readFileSync(destino, 'utf8')
    } catch {
      /* ausente: diverge */
    }
    if (atual !== novo) {
      console.error('docs/PROMPTS.md diverge dos comandos. Rode: node scripts/gerar-prompts.mjs')
      process.exit(1)
    }
    console.log('ok, docs/PROMPTS.md acompanha os comandos')
  } else {
    writeFileSync(destino, novo)
    console.log('docs/PROMPTS.md regravado')
  }
}

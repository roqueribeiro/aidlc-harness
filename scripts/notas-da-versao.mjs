#!/usr/bin/env node
/*
 * notas-da-versao: a versão que se publica e as notas dela, tiradas do próprio repositório.
 *
 *   node scripts/notas-da-versao.mjs          # imprime a versão (vX.Y.Z) e grava as notas em stdout depois de uma linha em branco
 *   node scripts/notas-da-versao.mjs --check  # exit 1 se a versão não fecha em todo lugar que a cita
 *
 * Por que existe: na v0.2.0 o workflow gerado passou a fixar AIDLC_REF: v0.2.0 antes de a tag existir,
 * e todo projeto novo teria o CI quebrado no checkout do kit. Aqui a versão do package.json tem de
 * bater com a do plugin.json, com o AIDLC_REF do workflow gerado e com uma seção datada do CHANGELOG;
 * o workflow release.yml usa este script para criar a tag e a release assim que a versão chega à main.
 */
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ehPrincipal } from './lib/principal.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/** Lê o que importa de uma raiz; separado para o teste montar raízes quebradas. */
export function ler(raiz = RAIZ) {
  const l = (p) => readFileSync(join(raiz, p), 'utf8')
  return {
    pacote: JSON.parse(l('package.json')).version,
    plugin: JSON.parse(l('plugins/aidlc-harness/.claude-plugin/plugin.json')).version,
    workflow: l('plugins/aidlc-harness/templates/project/aidlc-gate.yml'),
    changelog: l('CHANGELOG.md').replace(/\r\n/g, '\n'),
  }
}

/** Devolve { versao, notas, erros }. Sem erro, `notas` é a seção da versão no CHANGELOG. */
export function conferir({ pacote, plugin, workflow, changelog }) {
  const erros = []
  if (!/^\d+\.\d+\.\d+$/.test(pacote || '')) erros.push(`package.json: versão "${pacote}" não é X.Y.Z`)
  if (plugin !== pacote) erros.push(`plugin.json diz ${plugin}, package.json diz ${pacote}`)
  const ref = workflow.match(/AIDLC_REF:\s*(\S+)/)?.[1]
  if (ref !== `v${pacote}`) erros.push(`templates/project/aidlc-gate.yml fixa AIDLC_REF ${ref}, a versão é v${pacote}`)
  const esc = pacote.replace(/\./g, '\\.')
  const sec = changelog.match(new RegExp(`^## \\[${esc}\\] - (\\d{4}-\\d{2}-\\d{2})\\n([\\s\\S]*?)(?=^## \\[|(?![\\s\\S]))`, 'm'))
  if (!sec) erros.push(`CHANGELOG.md: falta a seção "## [${pacote}] - AAAA-MM-DD"`)
  else if (!sec[2].trim()) erros.push(`CHANGELOG.md: a seção ${pacote} está vazia`)
  return { versao: `v${pacote}`, notas: sec ? sec[2].trim() + '\n' : '', erros }
}

if (ehPrincipal(import.meta.url)) {
  const r = conferir(ler())
  if (r.erros.length) {
    console.error(`a versão não fecha:\n${r.erros.map((e) => `  ${e}`).join('\n')}`)
    process.exit(1)
  }
  if (process.argv.includes('--check')) console.log(`ok, ${r.versao} bate no package.json, no plugin.json, no AIDLC_REF do workflow gerado e no CHANGELOG`)
  else process.stdout.write(`${r.versao}\n\n${r.notas}`)
}

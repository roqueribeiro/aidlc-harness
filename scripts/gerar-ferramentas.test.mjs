#!/usr/bin/env node
/*
 * As páginas por ferramenta são geradas dos adaptadores; nenhuma ferramenta fica sem página, sem
 * fonte ou sem limites escritos, e o --check reprova página editada à mão.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { NOTAS, pagina, gerar, lerVerificacao } from './gerar-ferramentas.mjs'
import { FERRAMENTAS, planoDosAdaptadores } from '../plugins/aidlc-harness/lib/adaptadores.mjs'

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'gerar-ferramentas.mjs')

test('o repositório está em dia (--check passa)', () => {
  const r = spawnSync(process.execPath, [SCRIPT, '--check'], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stdout)
})

test('toda ferramenta tem nota com fonte oficial, como abrir e limites, nos dois idiomas', () => {
  assert.deepEqual(Object.keys(NOTAS).sort(), [...FERRAMENTAS].sort())
  for (const [id, n] of Object.entries(NOTAS)) {
    assert.match(n.fonte, /^https:\/\//, id)
    for (const l of ['en', 'pt']) {
      assert.ok(n.abrir[l]?.length > 10, `${id}.abrir.${l}`)
      assert.ok(n.limites[l]?.length >= 1, `${id}.limites.${l}`)
    }
    assert.equal(n.limites.en.length, n.limites.pt.length, `${id}: mesmo número de limites nos dois idiomas`)
  }
})

test('a página lista exatamente os arquivos que o aidlc-init gera para a ferramenta', () => {
  for (const id of FERRAMENTAS) {
    const p = pagina(id, 'en')
    for (const { destino } of planoDosAdaptadores([id])) assert.ok(p.includes(`\`${destino}\``), `${id}: ${destino}`)
  }
})

test('nada de "verificado" sem registro: ferramenta sem docs/compatibilidade/<id>.json diz "ainda não"', () => {
  for (const id of FERRAMENTAS) {
    if (lerVerificacao(id)) continue
    assert.match(pagina(id, 'en'), /Verified on a real machine \| not yet/, id)
    assert.match(pagina(id, 'pt'), /Verificado em máquina de verdade \| ainda não/, id)
  }
})

function raizCom(registro, prints = []) {
  const raiz = mkdtempSync(join(tmpdir(), 'compat-'))
  mkdirSync(join(raiz, 'docs/compatibilidade'), { recursive: true })
  if (registro !== undefined) writeFileSync(join(raiz, 'docs/compatibilidade/cursor.json'), typeof registro === 'string' ? registro : JSON.stringify(registro))
  for (const pr of prints) {
    mkdirSync(dirname(join(raiz, pr)), { recursive: true })
    writeFileSync(join(raiz, pr), 'png')
  }
  return raiz
}
const BOM = { versao: '2.1.0', data: '2026-11-10', sistema: 'macOS 15', prints: ['docs/assets/compatibilidade/cursor/janela.png'], viu: { regras: true, janela: true, hooks: true } }

test('registro válido com print existente vira "sim" na página, com a seção de evidência e a imagem', () => {
  const raiz = raizCom(BOM, BOM.prints)
  try {
    const r = lerVerificacao('cursor', raiz)
    const en = pagina('cursor', 'en', r)
    assert.match(en, /Verified on a real machine \| yes: version 2\.1\.0 on macOS 15, 2026-11-10/)
    assert.match(en, /## Evidence/)
    assert.ok(en.includes('](../assets/compatibilidade/cursor/janela.png)'))
    assert.ok(pagina('cursor', 'pt', r).includes('](../../assets/compatibilidade/cursor/janela.png)'))
  } finally {
    rmSync(raiz, { recursive: true, force: true })
  }
})

test('mutantes do registro: cada forma de "sim sem prova" reprova em vez de virar sim', () => {
  const casos = [
    ['print que não existe', BOM, []],
    ['sem prints', { ...BOM, prints: [] }, []],
    ['print fora da pasta da ferramenta', { ...BOM, prints: ['docs/assets/outro.png'] }, ['docs/assets/outro.png']],
    ['print que não é imagem', { ...BOM, prints: ['docs/assets/compatibilidade/cursor/log.txt'] }, ['docs/assets/compatibilidade/cursor/log.txt']],
    ['sem versão', { ...BOM, versao: '' }, BOM.prints],
    ['data fora do formato', { ...BOM, data: '10/11/2026' }, BOM.prints],
    ['sem o que viu', { ...BOM, viu: undefined }, BOM.prints],
    ['JSON quebrado', '{ "versao": ', []],
  ]
  for (const [nome, reg, prints] of casos) {
    const raiz = raizCom(reg, prints)
    try {
      assert.throws(() => lerVerificacao('cursor', raiz), /docs\/compatibilidade\/cursor\.json/, nome)
    } finally {
      rmSync(raiz, { recursive: true, force: true })
    }
  }
  const vazia = raizCom(undefined)
  try {
    assert.equal(lerVerificacao('cursor', vazia), null)
  } finally {
    rmSync(vazia, { recursive: true, force: true })
  }
})

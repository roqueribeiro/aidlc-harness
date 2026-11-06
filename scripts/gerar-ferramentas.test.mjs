#!/usr/bin/env node
/*
 * As páginas por ferramenta são geradas dos adaptadores; nenhuma ferramenta fica sem página, sem
 * fonte ou sem limites escritos, e o --check reprova página editada à mão.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NOTAS, pagina, gerar } from './gerar-ferramentas.mjs'
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

test('nada de "verificado" sem print: toda página diz que ainda não foi verificada em máquina de verdade', () => {
  for (const { arquivo, conteudo } of gerar()) if (/docs\/(tools|pt-BR\/ferramentas)\//.test(arquivo)) assert.match(conteudo, /not yet|ainda não/, arquivo)
})

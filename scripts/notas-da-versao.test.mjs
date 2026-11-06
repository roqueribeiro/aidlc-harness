#!/usr/bin/env node
/*
 * A versão publicada tem de fechar em todo lugar que a cita, e cada forma de não fechar reprova.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conferir, ler } from './notas-da-versao.mjs'

const BOM = {
  pacote: '1.4.0',
  plugin: '1.4.0',
  workflow: 'env:\n  AIDLC_REF: v1.4.0\n',
  changelog: '# Changelog\n\n## [Unreleased]\n\n## [1.4.0] - 2026-12-01\n\n### Fixed\n\n- algo\n\n## [1.3.0] - 2026-11-01\n\n- antigo\n',
}

test('o repositório fecha a própria versão', () => {
  const r = conferir(ler())
  assert.deepEqual(r.erros, [])
  assert.match(r.notas, /\S/)
})

test('versão coerente: devolve a tag e só a seção dela no CHANGELOG', () => {
  const r = conferir(BOM)
  assert.deepEqual(r.erros, [])
  assert.equal(r.versao, 'v1.4.0')
  assert.match(r.notas, /- algo/)
  assert.doesNotMatch(r.notas, /antigo/)
})

test('a última seção do CHANGELOG também é lida inteira', () => {
  const r = conferir({ ...BOM, changelog: '## [1.4.0] - 2026-12-01\n\n- só esta\n' })
  assert.deepEqual(r.erros, [])
  assert.match(r.notas, /só esta/)
})

test('mutantes: cada divergência de versão reprova', () => {
  const casos = [
    ['plugin.json atrás', { ...BOM, plugin: '1.3.0' }, /plugin\.json/],
    ['manifesto do Codex atrás', { ...BOM, portatil: '1.3.0' }, /\(Codex\)/],
    ['AIDLC_REF antigo', { ...BOM, workflow: 'AIDLC_REF: v1.3.0' }, /AIDLC_REF/],
    ['AIDLC_REF ausente', { ...BOM, workflow: '' }, /AIDLC_REF/],
    ['sem seção no CHANGELOG', { ...BOM, changelog: '## [Unreleased]\n\n- x\n' }, /falta a seção/],
    ['seção sem data', { ...BOM, changelog: '## [1.4.0]\n\n- x\n' }, /falta a seção/],
    ['seção vazia', { ...BOM, changelog: '## [1.4.0] - 2026-12-01\n\n## [1.3.0] - 2026-11-01\n- x\n' }, /vazia/],
    ['versão fora de X.Y.Z', { ...BOM, pacote: '1.4', plugin: '1.4', workflow: 'AIDLC_REF: v1.4' }, /X\.Y\.Z/],
  ]
  for (const [nome, entrada, rx] of casos) {
    const r = conferir(entrada)
    assert.ok(r.erros.some((e) => rx.test(e)), `${nome}: ${JSON.stringify(r.erros)}`)
  }
})

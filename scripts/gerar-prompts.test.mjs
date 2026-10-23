import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { corpoDoComando, paraColar, gerar } from './gerar-prompts.mjs'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const SCRIPT = join(RAIZ, 'scripts', 'gerar-prompts.mjs')
const PROMPTS = join(RAIZ, 'docs', 'PROMPTS.md')

describe('corpoDoComando', () => {
  test('tira o front matter', () => {
    assert.equal(corpoDoComando('---\ndescription: x\n---\n\nCorpo aqui.\n'), 'Corpo aqui.')
  })
  test('sem front matter, devolve o texto', () => {
    assert.equal(corpoDoComando('só texto\n'), 'só texto')
  })
})

describe('paraColar', () => {
  test('troca $ARGUMENTS pelo exemplo entre colchetes, em todas as ocorrências', () => {
    assert.equal(paraColar('a $ARGUMENTS b $ARGUMENTS', 'X'), 'a [X] b [X]')
  })
})

describe('gerar', () => {
  test('inclui o corpo de cada comando e nenhum front matter', () => {
    const md = gerar((arq) => `---\ndescription: d\n---\n\nTexto de ${arq} com $ARGUMENTS`)
    assert.match(md, /Texto de inception\.md com \[/)
    assert.match(md, /Texto de construction\.md com \[/)
    assert.doesNotMatch(md, /description: d/)
    assert.match(md, /Arquivo gerado/)
  })
})

describe('o arquivo versionado', () => {
  test('docs/PROMPTS.md acompanha os comandos (--check passa)', () => {
    const r = spawnSync('node', [SCRIPT, '--check'], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stderr)
  })

  test('--check reprova quando o arquivo diverge', () => {
    const original = readFileSync(PROMPTS, 'utf8')
    try {
      writeFileSync(PROMPTS, original + '\nlinha editada à mão\n')
      const r = spawnSync('node', [SCRIPT, '--check'], { encoding: 'utf8' })
      assert.equal(r.status, 1)
      assert.match(r.stderr, /diverge/)
    } finally {
      writeFileSync(PROMPTS, original)
    }
  })
})

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PARES, SECAO_NO_FIM, forma, hashDe, portuguesSobrando, verificar, atualizar } from './check-i18n.mjs'

const PT = '# Titulo\n\n## Secao\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n```bash\naidlc-gate\n```\n\nTexto com `aidlc-scan`.\n'
const EN = '# Title\n\n*Translation of [../X.md](../X.md)*\n\n## Section\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n```bash\naidlc-gate\n```\n\nText with `aidlc-scan`.\n'

/** Repositorio de mentira com todos os pares, cada um com o PT e o EN acima. */
function repo(muda = () => {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'aidlc-i18n-'))
  mkdirSync(join(raiz, 'docs/en'), { recursive: true })
  for (const [pt, en] of Object.entries(PARES)) {
    const base = pt.split('/').pop()
    writeFileSync(join(raiz, pt), PT)
    writeFileSync(join(raiz, en), EN.replace('../X.md', `../${base}`).replace('../X.md', `../${base}`))
  }
  for (const f of SECAO_NO_FIM) writeFileSync(join(raiz, f), '# x\n\n## English\n\ntexto\n')
  atualizar(raiz)
  muda(raiz)
  return raiz
}
const com = (muda) => {
  const raiz = repo(muda)
  const p = verificar(raiz)
  rmSync(raiz, { recursive: true, force: true })
  return p
}

describe('check-i18n', () => {
  test('o repositorio de mentira consistente passa', () => assert.deepEqual(com(), []))

  test('falta o par em ingles', () => {
    const p = com((r) => rmSync(join(r, 'docs/en/GLOSSARY.md')))
    assert.ok(p.some((x) => x.includes('falta o par em ingles')))
  })

  test('traducao que perdeu uma secao reprova', () => {
    const p = com((r) => writeFileSync(join(r, 'docs/en/GLOSSARY.md'), EN.replace('## Section\n\n', '').replace('../X.md', '../GLOSSARIO.md').replace('../X.md', '../GLOSSARIO.md')))
    assert.ok(p.some((x) => x.includes('titulos')))
  })

  test('traducao que perdeu um bloco de codigo ou uma tabela reprova', () => {
    const semBloco = EN.replace(/```bash[\s\S]*?```\n\n/, '')
    assert.ok(com((r) => writeFileSync(join(r, 'docs/en/GLOSSARY.md'), semBloco)).some((x) => x.includes('blocos')))
    const semTab = EN.replace(/\| a[\s\S]*?\| 1 \| 2 \|\n\n/, '')
    assert.ok(com((r) => writeFileSync(join(r, 'docs/en/GLOSSARY.md'), semTab)).some((x) => x.includes('tabelas')))
  })

  test('comando aidlc-* citado a menos ou a mais reprova', () => {
    const p = com((r) => writeFileSync(join(r, 'docs/en/GLOSSARY.md'), EN.replace('aidlc-scan', 'aidlc-phase').replace('../X.md', '../GLOSSARIO.md').replace('../X.md', '../GLOSSARIO.md')))
    assert.ok(p.some((x) => x.includes('nao cita') || x.includes('cita aidlc-phase')))
  })

  test('o original mudou depois da traducao: deriva', () => {
    const p = com((r) => writeFileSync(join(r, 'docs/GLOSSARIO.md'), PT + '\nUma frase nova.\n'))
    assert.ok(p.some((x) => x.includes('mudou depois da traducao')))
  })

  test('--atualizar grava o hash e a deriva some', () => {
    const raiz = repo((r) => writeFileSync(join(r, 'docs/GLOSSARIO.md'), PT + '\nUma frase nova.\n'))
    // a nova linha tem so palavras sem marca de forma; o ingles continua com a mesma forma
    assert.ok(verificar(raiz).some((x) => x.includes('mudou depois')))
    atualizar(raiz)
    assert.deepEqual(verificar(raiz), [])
    rmSync(raiz, { recursive: true, force: true })
  })

  test('portugues na prosa do ingles reprova, mas nao dentro de bloco nem de crases', () => {
    const p = com((r) => writeFileSync(join(r, 'docs/en/GLOSSARY.md'), EN.replace('Text with', 'Este texto não foi traduzido para o inglês, com uma pena. Text with').replace('../X.md', '../GLOSSARIO.md').replace('../X.md', '../GLOSSARIO.md')))
    assert.ok(p.some((x) => x.includes('portugues na prosa')))
    assert.deepEqual(portuguesSobrando('Text.\n\n```\nEste texto não foi traduzido para o inglês, com uma pena.\n```\n\nUse `não rodou` and "não rodou" here.\n'), [])
  })

  test('falta a secao English em SECURITY.md', () => {
    const p = com((r) => writeFileSync(join(r, 'SECURITY.md'), '# x\n\ntexto\n'))
    assert.ok(p.some((x) => x.includes('SECURITY.md') && x.includes('English')))
  })

  test('forma conta titulos, blocos e tabelas fora e dentro de bloco', () => {
    const f = forma('# a\n```\n# nao e titulo\n| nao e tabela\n```\n| t |\n')
    assert.equal(f.titulos, 1)
    assert.equal(f.blocos, 1)
    assert.equal(f.tabelas, 1)
    assert.equal(hashDe('x'), hashDe('x'))
  })
})

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { PARES, SECAO_NO_FIM, forma, hashDe, portuguesSobrando, verificar, atualizar } from './check-i18n.mjs'

const EN = '# Title\n\n## Section\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n```bash\naidlc-gate\n```\n\nText with `aidlc-scan`.\n'
const PT = (link) => `# Titulo\n\n*Tradução de [original](${link}).*\n\n## Secao\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n\`\`\`bash\naidlc-gate\n\`\`\`\n\nTexto com \`aidlc-scan\`.\n`
const linkDe = (pt, en) => relative(dirname(pt), en).split('\\').join('/')
const GLOSS_EN = 'docs/GLOSSARY.md'
const GLOSS_PT = 'docs/pt-BR/GLOSSARIO.md'

/** Repositorio de mentira com todos os pares consistentes e os hashes gravados. */
function repo(muda = () => {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'aidlc-i18n-'))
  mkdirSync(join(raiz, 'docs/pt-BR'), { recursive: true })
  for (const [en, pt] of Object.entries(PARES)) {
    writeFileSync(join(raiz, en), EN)
    writeFileSync(join(raiz, pt), PT(linkDe(pt, en)))
  }
  for (const f of SECAO_NO_FIM) writeFileSync(join(raiz, f), '# x\n\ntext\n\n## Português\n\ntexto\n')
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
const ptGloss = (fn) => fn(PT(linkDe(GLOSS_PT, GLOSS_EN)))

describe('check-i18n', () => {
  test('o repositorio de mentira consistente passa', () => assert.deepEqual(com(), []))

  test('falta o par em portugues', () => {
    assert.ok(com((r) => rmSync(join(r, GLOSS_PT))).some((x) => x.includes('falta o par em portugues')))
  })

  test('par que perdeu uma secao reprova', () => {
    const p = com((r) => writeFileSync(join(r, GLOSS_PT), ptGloss((t) => t.replace('## Secao\n\n', ''))))
    assert.ok(p.some((x) => x.includes('titulos')))
  })

  test('par que perdeu um bloco de codigo ou uma tabela reprova', () => {
    assert.ok(com((r) => writeFileSync(join(r, GLOSS_PT), ptGloss((t) => t.replace(/```bash[\s\S]*?```\n\n/, '')))).some((x) => x.includes('blocos')))
    assert.ok(com((r) => writeFileSync(join(r, GLOSS_PT), ptGloss((t) => t.replace(/\| a[\s\S]*?\| 1 \| 2 \|\n\n/, '')))).some((x) => x.includes('tabelas')))
  })

  test('comando aidlc-* citado a menos ou a mais reprova', () => {
    const p = com((r) => writeFileSync(join(r, GLOSS_PT), ptGloss((t) => t.replace('aidlc-scan', 'aidlc-phase'))))
    assert.ok(p.some((x) => x.includes('nao cita')))
    assert.ok(p.some((x) => x.includes('cita aidlc-phase')))
  })

  test('par sem link para o original reprova', () => {
    const p = com((r) => writeFileSync(join(r, GLOSS_PT), ptGloss((t) => t.replace(/\*Tradução de[^\n]*\n/, ''))))
    assert.ok(p.some((x) => x.includes('falta o link para o original')))
  })

  test('o original mudou depois da traducao: deriva', () => {
    const p = com((r) => writeFileSync(join(r, GLOSS_EN), EN + '\nA new sentence.\n'))
    assert.ok(p.some((x) => x.includes('mudou depois da traducao')))
  })

  test('--update grava o hash e a deriva some', () => {
    const raiz = repo((r) => writeFileSync(join(r, GLOSS_EN), EN + '\nA new sentence.\n'))
    assert.ok(verificar(raiz).some((x) => x.includes('mudou depois')))
    atualizar(raiz)
    assert.deepEqual(verificar(raiz), [])
    rmSync(raiz, { recursive: true, force: true })
  })

  test('portugues na prosa do ingles reprova, mas nao dentro de bloco nem de crases', () => {
    const p = com((r) => writeFileSync(join(r, GLOSS_EN), EN.replace('Text with', 'Este texto não foi traduzido para o inglês, com uma pena. Text with')))
    assert.ok(p.some((x) => x.includes('portugues na prosa')))
    assert.deepEqual(portuguesSobrando('Text.\n\n```\nEste texto não foi traduzido para o inglês, com uma pena.\n```\n\nUse `não rodou` and "não rodou" here.\n'), [])
  })

  test('falta a secao Português em SECURITY.md', () => {
    const p = com((r) => writeFileSync(join(r, 'SECURITY.md'), '# x\n\ntext\n'))
    assert.ok(p.some((x) => x.includes('SECURITY.md') && x.includes('Português')))
  })

  test('forma conta titulos, blocos e tabelas fora e dentro de bloco', () => {
    const f = forma('# a\n```\n# nao e titulo\n| nao e tabela\n```\n| t |\n')
    assert.equal(f.titulos, 1)
    assert.equal(f.blocos, 1)
    assert.equal(f.tabelas, 1)
    assert.equal(hashDe('x'), hashDe('x'))
  })
})

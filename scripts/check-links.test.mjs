import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slug } from './check-links.mjs'

const CHECK = join(fileURLToPath(new URL('.', import.meta.url)), 'check-links.mjs')

/** Um repositório de mentira com dois documentos e uma imagem. */
function repo(a, b = '# Outro\n\n## Seção com `código` e acento: ação\n') {
  const raiz = mkdtempSync(join(tmpdir(), 'aidlc-links-'))
  mkdirSync(join(raiz, 'docs/img'), { recursive: true })
  writeFileSync(join(raiz, 'docs/img/x.svg'), '<svg/>')
  writeFileSync(join(raiz, 'README.md'), a)
  writeFileSync(join(raiz, 'docs/OUTRO.md'), b)
  return raiz
}
const roda = (raiz, ...extra) => spawnSync(process.execPath, [CHECK, '--root', raiz, ...extra], { encoding: 'utf8' })
const com = (md) => {
  const raiz = repo(md)
  const r = roda(raiz)
  rmSync(raiz, { recursive: true, force: true })
  return r
}

describe('check-links', () => {
  test('o repositório passa', () => {
    const r = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('links válidos passam: arquivo, âncora com acento e pontuação, imagem, picture', () => {
    const r = com(
      [
        '# Raiz',
        '[ok](docs/OUTRO.md)',
        '[âncora](docs/OUTRO.md#seção-com-código-e-acento-ação)',
        '[mesma página](#raiz)',
        '![img](docs/img/x.svg)',
        '<picture><source srcset="docs/img/x.svg"><img src="docs/img/x.svg"></picture>',
        '[externo](https://exemplo.com/nao-confere)',
      ].join('\n'),
    )
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('mutante: arquivo inexistente reprova e diz arquivo e linha', () => {
    const r = com('# R\n\n[x](docs/NAO-EXISTE.md)\n')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /README\.md:3\s+docs\/NAO-EXISTE\.md\s+arquivo nao existe/)
  })

  test('mutante: âncora que nenhum título gera reprova', () => {
    const r = com('# R\n\n[x](docs/OUTRO.md#titulo-que-nao-existe)\n')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /nenhum titulo gera a ancora "titulo-que-nao-existe"/)
  })

  test('mutante: âncora para a mesma página que não existe reprova', () => {
    const r = com('# R\n\n[x](#nada-aqui)\n')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /nada-aqui/)
  })

  test('mutante: imagem inexistente reprova (markdown e HTML)', () => {
    const r = com('# R\n\n![x](docs/img/sumiu.svg)\n<img src="docs/img/sumiu2.svg">\n')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /sumiu\.svg/)
    assert.match(r.stderr, /sumiu2\.svg/)
  })

  test('mutante: link que sai do repositório reprova', () => {
    const r = com('# R\n\n[x](../fora.md)\n')
    assert.equal(r.status, 1)
    assert.match(r.stderr, /sai do repositorio/)
  })

  test('link dentro de bloco de código é exemplo, não link', () => {
    const r = com('# R\n\n```md\n[x](docs/NAO-EXISTE.md)\n```\n')
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('títulos repetidos ganham sufixo, como no GitHub', () => {
    const raiz = repo('# R\n\n[a](docs/OUTRO.md#igual)\n[b](docs/OUTRO.md#igual-1)\n[c](docs/OUTRO.md#igual-2)\n', '# O\n\n## Igual\n\n## Igual\n')
    const r = roda(raiz)
    rmSync(raiz, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /igual-2/)
    assert.doesNotMatch(r.stderr, /#igual"|#igual-1"/)
  })

  test('slug: minúsculas, sem pontuação, hífens, acento preservado', () => {
    assert.equal(slug('2. Contexto: onde o kit entra'), '2-contexto-onde-o-kit-entra')
    assert.equal(slug('Seção `código` e ação'), 'seção-código-e-ação')
    assert.equal(slug('14. Limites conhecidos'), '14-limites-conhecidos')
  })
})

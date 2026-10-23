import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Desenho, TEMAS } from './diagramas/lib.mjs'
import { gerarTodos } from './gerar-diagramas.mjs'

const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const GERADOR = join(RAIZ, 'scripts/gerar-diagramas.mjs')

/** Uma raiz descartável com os SVG versionados, para os mutantes mexerem sem tocar no repo. */
function copia() {
  const base = mkdtempSync(join(tmpdir(), 'aidlc-dg-'))
  mkdirSync(join(base, 'docs/assets'), { recursive: true })
  cpSync(join(RAIZ, 'docs/assets/diagramas'), join(base, 'docs/assets/diagramas'), { recursive: true })
  cpSync(join(RAIZ, 'plugins'), join(base, 'plugins'), { recursive: true })
  return base
}
const check = (base) => spawnSync(process.execPath, [GERADOR, '--check', '--root', base], { encoding: 'utf8' })

describe('gerar-diagramas', () => {
  test('o SVG versionado acompanha o código (o --check passa no repositório)', () => {
    const r = spawnSync(process.execPath, [GERADOR, '--check'], { encoding: 'utf8' })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  })

  test('a geração é determinística: duas rodadas dão bytes idênticos', () => {
    assert.deepEqual(gerarTodos(), gerarTodos())
  })

  test('cada diagrama existe nos dois temas e é XML bem formado (tags balanceadas)', () => {
    const todos = gerarTodos()
    const nomes = Object.keys(todos)
    assert.ok(nomes.length >= 18)
    for (const n of nomes) assert.match(n, /\.(claro|escuro)\.svg$/)
    for (const n of nomes.filter((n) => n.endsWith('.claro.svg'))) assert.ok(nomes.includes(n.replace('.claro.', '.escuro.')), `${n} sem par escuro`)
    for (const [n, svg] of Object.entries(todos)) {
      assert.ok(svg.startsWith('<svg '), n)
      assert.ok(svg.trimEnd().endsWith('</svg>'), n)
      assert.equal((svg.match(/<g>/g) || []).length, (svg.match(/<\/g>/g) || []).length, `${n}: <g> desbalanceado`)
      assert.equal((svg.match(/<text /g) || []).length, (svg.match(/<\/text>/g) || []).length, `${n}: <text> desbalanceado`)
    }
  })

  test('os dois temas usam o fundo do próprio tema', () => {
    const todos = gerarTodos()
    assert.ok(todos['contexto.claro.svg'].includes(`fill="${TEMAS.claro.fundo}"`))
    assert.ok(todos['contexto.escuro.svg'].includes(`fill="${TEMAS.escuro.fundo}"`))
  })

  test('a contagem no diagrama vem do inventário real, não de número escrito à mão', () => {
    const n = readdirSync(join(RAIZ, 'plugins/aidlc-harness/tools')).length
    assert.match(gerarTodos()['contexto.claro.svg'], new RegExp(`${n} EXECUT`))
  })

  test('trava de texto: caixa com texto que não cabe lança erro em vez de gerar SVG cortado', () => {
    const d = new Desenho('t', 400, 200, TEMAS.claro)
    assert.throws(() => d.caixa(0, 0, 100, 60, 'um título comprido demais para caber', []), /nao cabe/)
    assert.throws(() => d.caixa(0, 0, 100, 60, 'ok', ['uma linha comprida demais para caber nessa caixa']), /nao cabe/)
    assert.throws(() => d.caixa(0, 0, 300, 30, 'ok', ['a', 'b', 'c']), /altura/)
    assert.doesNotThrow(() => d.caixa(0, 0, 300, 90, 'ok', ['a', 'b']))
  })

  test('texto com caracteres especiais é escapado', () => {
    const d = new Desenho('t', 400, 200, TEMAS.claro)
    d.texto(0, 0, '<script>&"x"')
    assert.ok(!d.svg().includes('<script>'))
    assert.ok(d.svg().includes('&lt;script&gt;&amp;&quot;x&quot;'))
  })

  test('mutante: SVG alterado à mão reprova o --check', () => {
    const base = copia()
    const p = join(base, 'docs/assets/diagramas/contexto.claro.svg')
    writeFileSync(p, readFileSync(p, 'utf8').replace('Equipe', 'Equipe EDITADA'))
    const r = check(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /contexto\.claro\.svg: difere/)
  })

  test('mutante: SVG apagado reprova o --check', () => {
    const base = copia()
    rmSync(join(base, 'docs/assets/diagramas/hooks.escuro.svg'))
    const r = check(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /hooks\.escuro\.svg: nao existe/)
  })

  test('mutante: SVG sobrando (nenhum diagrama o gera) reprova o --check', () => {
    const base = copia()
    writeFileSync(join(base, 'docs/assets/diagramas/fantasma.claro.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    const r = check(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /fantasma\.claro\.svg: sobrando/)
  })

  test('mutante: hook novo no plugin muda o diagrama e o --check reprova até regenerar', () => {
    const base = copia()
    const hooks = join(base, 'plugins/aidlc-harness/hooks')
    writeFileSync(join(hooks, 'hook-novo.mjs'), '// novo\n')
    const r = check(base)
    rmSync(base, { recursive: true, force: true })
    assert.equal(r.status, 1)
    assert.match(r.stderr, /containers\.claro\.svg|contexto\.claro\.svg/)
  })
})

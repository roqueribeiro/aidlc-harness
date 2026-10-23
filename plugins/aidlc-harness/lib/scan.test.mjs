import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { lerRelatorio, avalia, normalizaSeveridade, severidadePorNota, ErroDeRelatorio } from './scan.mjs'

const TOOL = fileURLToPath(new URL('../tools/aidlc-scan', import.meta.url))

const neutro = (extra = {}) => JSON.stringify({ coverage_complete: true, scanners_ran: ['semgrep', 'trivy'], findings: [], ...extra })
const achado = (severity, key = 'k1') => ({ key, severity, title: `achado ${key}`, location: 'src/a.js:3' })

describe('severidade', () => {
  test('normaliza nomes de varias plataformas', () => {
    assert.equal(normalizaSeveridade('HIGH'), 'high')
    assert.equal(normalizaSeveridade('Moderate'), 'medium')
    assert.equal(normalizaSeveridade('error'), 'high')
    assert.equal(normalizaSeveridade('note'), 'low')
    assert.equal(normalizaSeveridade('inventada'), null)
  })
  test('nota CVSS vira severidade nas faixas padrao', () => {
    assert.equal(severidadePorNota('9.8'), 'critical')
    assert.equal(severidadePorNota(7), 'high')
    assert.equal(severidadePorNota(4.0), 'medium')
    assert.equal(severidadePorNota(0.1), 'low')
    assert.equal(severidadePorNota(0), 'info')
    assert.equal(severidadePorNota('abc'), null)
  })
})

describe('formato neutro', () => {
  test('limpo: cobertura completa e nenhum achado', () => {
    const r = avalia(lerRelatorio(neutro()))
    assert.equal(r.codigo, 0)
  })
  test('achado high reprova com 1 e abaixo do limite passa', () => {
    assert.equal(avalia(lerRelatorio(neutro({ findings: [achado('high')] }))).codigo, 1)
    assert.equal(avalia(lerRelatorio(neutro({ findings: [achado('medium')] }))).codigo, 0)
  })
  test('--fail-on muda o limite', () => {
    const rel = lerRelatorio(neutro({ findings: [achado('medium')] }))
    assert.equal(avalia(rel, { falhaEm: 'medium' }).codigo, 1)
    assert.equal(avalia(rel, { falhaEm: 'critical' }).codigo, 0)
    assert.throws(() => avalia(rel, { falhaEm: 'altissimo' }), ErroDeRelatorio)
  })
  test('MUTANTE: cobertura incompleta com zero achados NAO e limpo (e o coracao do contrato)', () => {
    const r = avalia(lerRelatorio(neutro({ coverage_complete: false })))
    assert.equal(r.codigo, 2)
    assert.match(r.motivo, /cobertura incompleta/)
  })
  test('MUTANTE: relatorio que nao diz a cobertura NAO e limpo', () => {
    const doc = JSON.parse(neutro())
    delete doc.coverage_complete
    const r = avalia(lerRelatorio(JSON.stringify(doc)))
    assert.equal(r.codigo, 2)
    assert.match(r.motivo, /nao diz/)
  })
  test('scanner exigido ausente da 2, mesmo com cobertura completa', () => {
    const rel = lerRelatorio(neutro())
    assert.equal(avalia(rel, { exigeScanners: ['semgrep'] }).codigo, 0)
    const r = avalia(rel, { exigeScanners: ['semgrep', 'gitleaks'] })
    assert.equal(r.codigo, 2)
    assert.match(r.motivo, /gitleaks/)
  })
  test('severidade desconhecida e erro, nunca passa calada', () => {
    assert.throws(() => lerRelatorio(neutro({ findings: [achado('catastrofico')] })), /desconhecida/)
  })
  test('JSON invalido e formato irreconhecivel sao erro de relatorio', () => {
    assert.throws(() => lerRelatorio('{nao e json'), /JSON valido/)
    assert.throws(() => lerRelatorio('{"x":1}'), /nao reconheci/)
  })
})

describe('baseline', () => {
  const antes = lerRelatorio(neutro({ findings: [achado('high', 'a'), achado('medium', 'b')] }))
  test('separa resolvidos, restantes e novos pela chave', () => {
    const agora = lerRelatorio(neutro({ findings: [achado('medium', 'b'), achado('low', 'c')] }))
    const r = avalia(agora, { baseline: antes })
    assert.deepEqual(r.resolvidos.map((a) => a.chave), ['a'])
    assert.deepEqual(r.restantes.map((a) => a.chave), ['b'])
    assert.deepEqual(r.novos.map((a) => a.chave), ['c'])
    assert.equal(r.codigo, 0)
  })
  test('MUTANTE: scanner que rodou antes e sumiu agora NAO parece "tudo resolvido"', () => {
    const agora = lerRelatorio(neutro({ scanners_ran: ['trivy'], findings: [] }))
    const r = avalia(agora, { baseline: antes })
    assert.equal(r.codigo, 2)
    assert.match(r.motivo, /semgrep/)
  })
  test('baseline sem cobertura completa nao serve de base', () => {
    const ruim = lerRelatorio(neutro({ coverage_complete: false }))
    assert.equal(avalia(lerRelatorio(neutro()), { baseline: ruim }).codigo, 2)
  })
  test('regressao no limite reprova mesmo com baseline', () => {
    const agora = lerRelatorio(neutro({ findings: [achado('critical', 'novo')] }))
    assert.equal(avalia(agora, { baseline: antes }).codigo, 1)
  })
})

describe('SARIF', () => {
  const sarif = (runs) => JSON.stringify({ version: '2.1.0', runs })
  const run = (extra = {}) => ({ tool: { driver: { name: 'Semgrep', rules: [{ id: 'r1', properties: { 'security-severity': '8.1' } }] } }, results: [], ...extra })
  const resultado = (extra = {}) => ({
    ruleId: 'r1',
    level: 'warning',
    message: { text: 'sql injection' },
    locations: [{ physicalLocation: { artifactLocation: { uri: 'src/db.js' }, region: { startLine: 10 } } }],
    ...extra,
  })

  test('detecta o formato e le scanner e local', () => {
    const rel = lerRelatorio(sarif([run({ results: [resultado()] })]))
    assert.equal(rel.formato, 'sarif')
    assert.deepEqual(rel.scanners, ['Semgrep'])
    assert.equal(rel.achados[0].local, 'src/db.js:10')
  })
  test('a nota security-severity da regra vence o level', () => {
    const rel = lerRelatorio(sarif([run({ results: [resultado()] })]))
    assert.equal(rel.achados[0].severidade, 'high')
    assert.equal(avalia(rel).codigo, 1)
  })
  test('sem nota, usa o level (error vira high)', () => {
    const r = run({ results: [resultado({ ruleId: 'sem-regra', level: 'error' })] })
    assert.equal(lerRelatorio(sarif([r])).achados[0].severidade, 'high')
  })
  test('MUTANTE: SARIF sem nenhuma execucao (runs vazio) NAO e limpo', () => {
    const r = avalia(lerRelatorio(sarif([])))
    assert.equal(r.codigo, 2)
  })
  test('MUTANTE: invocacao com executionSuccessful=false marca cobertura incompleta', () => {
    const r = avalia(lerRelatorio(sarif([run({ invocations: [{ executionSuccessful: false }] })])))
    assert.equal(r.codigo, 2)
  })
  test('varias execucoes: uma falha derruba a cobertura de todas', () => {
    const ok = run()
    const ruim = run({ tool: { driver: { name: 'CodeQL' } }, invocations: [{ executionSuccessful: false }] })
    const rel = lerRelatorio(sarif([ok, ruim]))
    assert.deepEqual(rel.scanners, ['Semgrep', 'CodeQL'])
    assert.equal(avalia(rel).codigo, 2)
  })
  test('partialFingerprints vira a chave estavel para o baseline', () => {
    const rel = lerRelatorio(sarif([run({ results: [resultado({ partialFingerprints: { primaryLocationLineHash: 'abc123' } })] })]))
    assert.equal(rel.achados[0].chave, 'abc123')
  })
})

describe('bundle do RoqueShield (contrato documentado, sem instancia real)', () => {
  const vuln = (severity, key) => ({ id: `id-${key}`, deduped_key: key, title: `vuln ${key}`, severity, instances: [{ location: 'app/x.py:9', evidence: '...' }] })
  const bundle = (extra = {}) =>
    JSON.stringify({
      schema_version: '1.0.0',
      scan: { id: 's1', scanners_executed: ['semgrep', 'trivy'], scanners_failed: [] },
      vulnerabilities: [],
      ...extra,
    })

  test('forma da especificacao: vulnerabilities + scan.scanners_failed vazio = cobertura completa', () => {
    const rel = lerRelatorio(bundle({ vulnerabilities: [vuln('high', 'k')] }))
    assert.equal(rel.formato, 'roqueshield')
    assert.equal(rel.coberturaCompleta, true)
    assert.equal(rel.achados[0].chave, 'k')
    assert.equal(rel.achados[0].local, 'app/x.py:9')
    assert.equal(avalia(rel).codigo, 1)
  })
  test('MUTANTE: scanners_failed nao vazio NAO e limpo', () => {
    const rel = lerRelatorio(bundle({ scan: { id: 's', scanners_executed: ['semgrep'], scanners_failed: ['zap'] } }))
    assert.equal(avalia(rel).codigo, 2)
  })
  test('MUTANTE: nenhum scanner executado NAO e limpo', () => {
    const rel = lerRelatorio(bundle({ scan: { id: 's', scanners_executed: [], scanners_failed: [] } }))
    assert.equal(avalia(rel).codigo, 2)
  })
  test('forma do guia de integracao: findings + coverage_complete + scanners_ran', () => {
    const doc = { schema_version: '1.0.0', scan: {}, coverage_complete: true, scanners_ran: ['semgrep'], findings: [vuln('low', 'z')] }
    const rel = lerRelatorio(JSON.stringify(doc), 'roqueshield')
    assert.equal(rel.coberturaCompleta, true)
    assert.deepEqual(rel.scanners, ['semgrep'])
    assert.equal(avalia(rel).codigo, 0)
  })
  test('bundle sem nenhuma informacao de cobertura nao e presumido completo', () => {
    const rel = lerRelatorio(JSON.stringify({ schema_version: '1.0.0', scan: { id: 's' }, vulnerabilities: [] }))
    assert.equal(rel.coberturaCompleta, null)
    assert.equal(avalia(rel).codigo, 2)
  })
})

describe('aidlc-scan na linha de comando', () => {
  const roda = (conteudo, ...args) => {
    const dir = mkdtempSync(join(tmpdir(), 'aidlc-scan-'))
    const arq = join(dir, 'relatorio.json')
    writeFileSync(arq, conteudo)
    const r = spawnSync(process.execPath, [TOOL, arq, ...args], { encoding: 'utf8' })
    rmSync(dir, { recursive: true, force: true })
    return r
  }

  test('limpo sai 0, reprovado 1, nao rodou 2', () => {
    assert.equal(roda(neutro()).status, 0)
    assert.equal(roda(neutro({ findings: [achado('critical')] })).status, 1)
    assert.equal(roda(neutro({ coverage_complete: false })).status, 2)
  })
  test('arquivo inexistente e relatorio ilegivel sao "nao rodou", nunca limpo', () => {
    const r = spawnSync(process.execPath, [TOOL, '/nao/existe.json'], { encoding: 'utf8' })
    assert.equal(r.status, 2)
    assert.match(r.stderr, /NAO RODOU/)
    assert.equal(roda('lixo').status, 2)
  })
  test('sem argumentos mostra a ajuda e sai 2', () => {
    const r = spawnSync(process.execPath, [TOOL], { encoding: 'utf8' })
    assert.equal(r.status, 2)
    assert.match(r.stdout, /--require-scanners/)
  })
  test('--json devolve o codigo e a contagem', () => {
    const r = roda(neutro({ findings: [achado('high')] }), '--json')
    const j = JSON.parse(r.stdout)
    assert.equal(j.codigo, 1)
    assert.equal(j.achados, 1)
  })
  test('--require-scanners e --fail-on chegam na avaliacao', () => {
    assert.equal(roda(neutro(), '--require-scanners', 'gitleaks').status, 2)
    assert.equal(roda(neutro({ findings: [achado('medium')] }), '--fail-on', 'medium').status, 1)
  })
  test('--baseline compara dois arquivos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aidlc-scan-'))
    const antes = join(dir, 'antes.json')
    const agora = join(dir, 'agora.json')
    writeFileSync(antes, neutro({ findings: [achado('high', 'a')] }))
    writeFileSync(agora, neutro({ scanners_ran: ['trivy'] }))
    const r = spawnSync(process.execPath, [TOOL, agora, '--baseline', antes], { encoding: 'utf8' })
    rmSync(dir, { recursive: true, force: true })
    assert.equal(r.status, 2)
    assert.match(r.stderr, /semgrep/)
  })
})

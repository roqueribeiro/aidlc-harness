import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * Os relatorios de exemplo em docs/exemplos/scan/ sao citados na documentacao com o codigo de
 * saida que cada um produz. Exemplo de documentacao que nao roda mais e o jeito mais comum de
 * a documentacao mentir: aqui cada um e executado e o codigo de saida e conferido.
 */
const RAIZ = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SCAN = join(RAIZ, 'plugins/aidlc-harness/tools/aidlc-scan')
const roda = (arquivo, ...extra) => spawnSync(process.execPath, [SCAN, join(RAIZ, 'docs/exemplos/scan', arquivo), ...extra], { encoding: 'utf8' })

describe('exemplos de relatório de varredura', () => {
  const ESPERADO = [
    ['neutro-limpo.json', 0, /LIMPO/],
    ['neutro-reprovado.json', 1, /REPROVADO/],
    ['neutro-nao-rodou.json', 2, /NAO RODOU/],
    ['sarif.json', 1, /sarif/],
    ['roqueshield-bundle.json', 1, /roqueshield/],
    ['roqueshield-scanner-falhou.json', 2, /NAO RODOU/],
  ]
  for (const [arquivo, codigo, saida] of ESPERADO) {
    test(`${arquivo} sai com ${codigo}`, () => {
      const r = roda(arquivo)
      assert.equal(r.status, codigo, r.stdout + r.stderr)
      assert.match(r.stdout + r.stderr, saida)
    })
  }

  test('o limite mais alto muda o resultado: com --fail-on critical, o reprovado passa', () => {
    assert.equal(roda('neutro-reprovado.json', '--fail-on', 'critical').status, 0)
  })

  test('--require-scanners exigindo um scanner que não rodou dá 2 mesmo com relatório limpo', () => {
    const r = roda('neutro-limpo.json', '--require-scanners', 'semgrep,gitleaks')
    assert.equal(r.status, 2)
    assert.match(r.stdout + r.stderr, /gitleaks/)
  })

  test('--baseline: o mesmo relatório contra si mesmo não tem achado novo', () => {
    const f = join(RAIZ, 'docs/exemplos/scan/neutro-reprovado.json')
    const r = spawnSync(process.execPath, [SCAN, f, '--baseline', f], { encoding: 'utf8' })
    assert.match(r.stdout + r.stderr, /0 novo\(s\)/)
  })
})

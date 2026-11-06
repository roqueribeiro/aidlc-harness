#!/usr/bin/env node
/*
 * O `reject` de cada manifesto contra a saída real do runner, verde e vermelha.
 *
 * Achado em 06/11/2026: o `reject` dos manifestos Node era avaliado com a flag `i`, e o trecho
 * `FAIL ` casava o `# fail 0` do `node --test`. Todo projeto Node com `node --test` reprovava o
 * gate com a suíte verde, desde a v0.1.0. Ninguém viu porque nenhum teste passava uma saída verde
 * pelo padrão. Estas amostras são saídas de verdade, capturadas na mesma data (node 22, go, bun,
 * Maven 3 com JUnit 5); as de jest, pytest e dotnet seguem o formato documentado de cada runner.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadManifests } from './detect.mjs'

const reject = (tech, id) => {
  const g = loadManifests().find((m) => m.tech === tech).gates.find((x) => x.id === id)
  return (saida) => new RegExp(g.reject, 'im').test(saida) // mesma avaliação do aidlc-gate
}

const NODE_VERDE = '1..1\n# tests 1\n# suites 0\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n'
const NODE_VERMELHO = '1..1\n# tests 1\n# suites 0\n# pass 0\n# fail 1\n# cancelled 0\n'
const JEST_VERDE = 'PASS  src/soma.test.js\nTests:       3 passed, 3 total\n'
const JEST_VERMELHO = 'FAIL  src/soma.test.js\nTests:       1 failed, 2 passed, 3 total\n'
const MOCHA_VERMELHO = '  2 passing (8ms)\n  1 failing\n'

const CASOS = [
  ['node-yarn', 'test', [NODE_VERDE, JEST_VERDE, '  3 passing (9ms)\n'], [NODE_VERMELHO, JEST_VERMELHO, MOCHA_VERMELHO]],
  ['node-npm', 'test', [NODE_VERDE, JEST_VERDE], [NODE_VERMELHO, JEST_VERMELHO]],
  ['node-pnpm', 'test', [NODE_VERDE, JEST_VERDE], [NODE_VERMELHO, JEST_VERMELHO]],
  ['node-bun', 'test', ['\n 1 pass\n 0 fail\n 1 expect() calls\nRan 1 test across 1 file.\n'], ['(fail) soma\n\n 0 pass\n 1 fail\n 1 expect() calls\n']],
  ['go', 'test', ['ok  \texemplo\t(cached)\n'], ['--- FAIL: TestSoma (0.00s)\n    soma_test.go:3: x\nFAIL\nFAIL\texemplo\t0.002s\nFAIL\n']],
  ['java-maven', 'verify', ['[INFO] Tests run: 1, Failures: 0, Errors: 0, Skipped: 0\n[INFO] BUILD SUCCESS\n'], ['[ERROR] Tests run: 1, Failures: 1, Errors: 0, Skipped: 0\n[INFO] BUILD FAILURE\n']],
  ['java-gradle', 'check', ['BUILD SUCCESSFUL in 4s\n'], ['FAILURE: Build failed with an exception.\nBUILD FAILED in 9s\n']],
  ['python-uv', 'unit', ['============ 3 passed in 0.12s ============\n'], ['============ 1 failed, 2 passed in 0.12s ============\n', '======= 1 error in 0.10s =======\n']],
  ['dotnet', 'test', ['Passed!  - Failed:     0, Passed:     3, Skipped:     0, Total:     3\n'], ['Failed!  - Failed:     1, Passed:     2, Skipped:     0, Total:     3\n']],
]

for (const [tech, id, verdes, vermelhas] of CASOS) {
  test(`${tech}: saída verde passa e saída vermelha reprova`, () => {
    const r = reject(tech, id)
    for (const s of verdes) assert.equal(r(s), false, `verde reprovado:\n${s}`)
    for (const s of vermelhas) assert.equal(r(s), true, `vermelho aprovado:\n${s}`)
  })
}

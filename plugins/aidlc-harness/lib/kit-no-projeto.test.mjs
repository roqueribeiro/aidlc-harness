#!/usr/bin/env node
/*
 * O kit dentro do projeto (.aidlc/kit/): o que o init grava roda sem nada instalado, e a cópia
 * não se edita.
 *
 * Por que existe: até a 0.2.0 os hooks gerados chamavam `aidlc-hook` pelo PATH. Quem preparou o
 * projeto com `npx ... init` não tinha esse executável, e o hook do Cursor e do Copilot saía com 127
 * em todo comando. Os testes da época passavam porque rodavam com o kit no PATH.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { appendFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import { PASTA_DO_KIT, aplicar, conferirSincronia, kitDivergente, planejar, planoDoKit, sincronizar } from './init.mjs'
import { hooksPresentes, mesclarHooks } from './adaptadores.mjs'

const novo = (ferramentas) => {
  const d = mkdtempSync(join(tmpdir(), 'aidlc-kitproj-'))
  aplicar(d, planejar({ nome: 'app-exemplo', descricao: 'Exemplo', ferramentas }))
  return d
}

/** Todo `command` de um JSON de hooks, em qualquer profundidade. */
const comandos = (x) => (Array.isArray(x) ? x.flatMap(comandos) : x && typeof x === 'object' ? [...(typeof x.command === 'string' ? [x.command] : []), ...Object.values(x).flatMap(comandos)] : [])

/** Ambiente de quem nunca instalou o kit: PATH só com a pasta do node, HOME vazio. */
function ambienteLimpo() {
  const home = mkdtempSync(join(tmpdir(), 'aidlc-home-'))
  const env = { HOME: home, USERPROFILE: home, SystemRoot: process.env.SystemRoot, ComSpec: process.env.ComSpec, PATHEXT: process.env.PATHEXT }
  env[process.platform === 'win32' ? 'Path' : 'PATH'] = [dirname(process.execPath), ...(process.platform === 'win32' ? [] : ['/usr/bin', '/bin'])].join(delimiter)
  return { env, home }
}

describe('a cópia do kit no projeto', () => {
  test('o init grava a cópia e o --check passa logo depois', () => {
    const d = novo(['claude', 'cursor'])
    try {
      assert.ok(planoDoKit().length > 50)
      assert.ok(readFileSync(join(d, PASTA_DO_KIT, 'tools/aidlc-hook'), 'utf8').length > 100)
      assert.deepEqual(conferirSincronia(d), [])
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })

  test('a cópia leva o executável e não leva teste', () => {
    const destinos = planoDoKit().map((p) => p.destino)
    for (const t of ['aidlc-gate', 'aidlc-phase', 'aidlc-hook', 'aidlc-init', 'aidlc-secscan']) assert.ok(destinos.includes(`${PASTA_DO_KIT}/tools/${t}`), t)
    assert.ok(destinos.includes(`${PASTA_DO_KIT}/.claude-plugin/plugin.json`), 'a versão do kit vai junto')
    assert.ok(!destinos.some((x) => /\.test\.mjs$/.test(x)))
  })

  test('mutantes: cópia editada, arquivo faltando e arquivo a mais reprovam o --check; o --sync conserta', () => {
    const d = novo(['cursor'])
    try {
      appendFileSync(join(d, PASTA_DO_KIT, 'quality/node-yarn.json'), ' ')
      assert.match(kitDivergente(d).join('\n'), /quality\/node-yarn\.json: diverge/)
      rmSync(join(d, PASTA_DO_KIT, 'tools/aidlc-phase'))
      assert.match(kitDivergente(d).join('\n'), /tools\/aidlc-phase: falta/)
      writeFileSync(join(d, PASTA_DO_KIT, 'tools/aidlc-atalho'), 'process.exit(0)\n')
      assert.match(kitDivergente(d).join('\n'), /tools\/aidlc-atalho: nao faz parte/)
      rmSync(join(d, PASTA_DO_KIT), { recursive: true })
      assert.match(conferirSincronia(d).join('\n'), /\.aidlc\/kit\/: falta a copia do kit/)
      sincronizar(d)
      assert.deepEqual(conferirSincronia(d), [])
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })
})

describe('entradas antigas `aidlc-hook ...` (até a 0.2.0)', () => {
  const nosso = { version: 1, hooks: { stop: [{ command: 'node .aidlc/kit/tools/aidlc-hook parada --formato cursor' }] } }
  const antigo = { version: 1, hooks: { stop: [{ command: '.cursor/hooks/avisar.sh' }, { command: 'aidlc-hook parada --formato cursor' }] } }

  test('não contam como presentes, e a mescla as troca pela nova sem tocar nas do time', () => {
    assert.equal(hooksPresentes({ hooks: { ...antigo.hooks, stop: [...antigo.hooks.stop, ...nosso.hooks.stop] } }, nosso), false)
    const m = mesclarHooks(antigo, nosso)
    assert.deepEqual(comandos(m.hooks), ['.cursor/hooks/avisar.sh', 'node .aidlc/kit/tools/aidlc-hook parada --formato cursor'])
    assert.equal(hooksPresentes(m, nosso), true)
  })

  test('o --sync de um projeto da 0.2.0 deixa o arquivo sem a entrada antiga', () => {
    const d = novo(['cursor'])
    try {
      writeFileSync(join(d, '.cursor/hooks.json'), JSON.stringify({ version: 1, hooks: { beforeShellExecution: [{ command: 'aidlc-hook shell --formato cursor' }], stop: [{ command: 'aidlc-hook parada --formato cursor', loop_limit: 3 }] } }))
      assert.match(conferirSincronia(d).join('\n'), /\.cursor\/hooks\.json/)
      sincronizar(d)
      const cmds = comandos(JSON.parse(readFileSync(join(d, '.cursor/hooks.json'), 'utf8')).hooks)
      assert.ok(cmds.every((c) => c.startsWith('node .aidlc/kit/tools/aidlc-hook ')), cmds.join(' | '))
      assert.deepEqual(conferirSincronia(d), [])
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })
})

describe('os hooks gerados rodam sem nada instalado', () => {
  // A string exata do arquivo gerado, pelo shell, na raiz do projeto, como a ferramenta faria.
  const arquivos = { copilot: '.github/hooks/aidlc.json', cursor: '.cursor/hooks.json', codex: '.codex/hooks.json' }
  const entrada = (formato, comando) =>
    formato === 'copilot' ? { toolName: 'bash', toolArgs: JSON.stringify({ command: comando }) } : formato === 'cursor' ? { command: comando, cwd: '.' } : { tool_name: 'Bash', tool_input: { command: comando } }

  for (const [ferramenta, arquivo] of Object.entries(arquivos)) {
    test(`${ferramenta}: o comando de shell seguro passa e o com gerenciador errado é barrado, sem aidlc no PATH`, () => {
      const d = novo([ferramenta])
      const { env, home } = ambienteLimpo()
      try {
        writeFileSync(join(d, 'package.json'), JSON.stringify({ name: 'app-exemplo', packageManager: 'yarn@1.22.22' }))
        writeFileSync(join(d, 'yarn.lock'), '')
        const cmds = comandos(JSON.parse(readFileSync(join(d, arquivo), 'utf8')).hooks)
        const shell = cmds.find((c) => / shell /.test(c))
        assert.ok(shell, `${arquivo} sem hook de shell`)
        assert.match(shell, /^node \.aidlc\/kit\/tools\/aidlc-hook /, 'o hook chama a cópia do projeto, não o PATH')
        const rodar = (cmd) => spawnSync(shell, { cwd: d, env, shell: true, encoding: 'utf8', input: JSON.stringify(entrada(ferramenta, cmd)) })
        const ok = rodar('git status')
        assert.notEqual(ok.status, 127, `o hook não achou o executável: ${ok.stderr}`)
        assert.equal(ok.status, 0, ok.stderr + ok.stdout)
        const errado = rodar('npm install left-pad')
        assert.notEqual(errado.status, 127, errado.stderr)
        assert.ok(errado.status === 2 || /"(permission|permissionDecision|decision)":\s*"(deny|block)"/.test(errado.stdout), `o gerenciador errado precisa ser barrado: ${errado.status} ${errado.stdout}`)
      } finally {
        rmSync(d, { recursive: true, force: true })
        rmSync(home, { recursive: true, force: true })
      }
    })
  }
})

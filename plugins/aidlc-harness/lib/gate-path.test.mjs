import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'

/*
 * O gate chama os executaveis do proprio kit. Num runner de CI limpo eles nao estao no PATH, e o
 * gate dava `command not found` (127) por um defeito que nao era do projeto. Este teste roda o gate
 * com um PATH que NAO contem os executaveis do kit e exige que um gate `aidlc-scan` ache o programa.
 */
const GATE = join(fileURLToPath(new URL('.', import.meta.url)), '../tools/aidlc-gate')

function projeto(cmd) {
  const dir = mkdtempSync(join(tmpdir(), 'aidlc-gatepath-'))
  spawnSync('git', ['init', '-q'], { cwd: dir })
  mkdirSync(join(dir, '.aidlc/quality'), { recursive: true })
  writeFileSync(join(dir, 'marcador'), '')
  writeFileSync(
    join(dir, '.aidlc/quality/proj.json'),
    JSON.stringify({
      tech: 'proj',
      label: 'p',
      repos: ['x'],
      detect: { anyFiles: ['marcador'], priority: 99 },
      gates: [{ id: 'scan', label: 'varredura', blocking: true, cmd }],
      evidence: [{ id: 'e', label: 'e', markers: ['x'] }],
    }),
  )
  return dir
}

// PATH sem nenhuma pasta do kit: so o node (que os executaveis precisam) e o basico do sistema.
const WIN = process.platform === 'win32'
const SYS_DIRS = WIN ? [join(process.env.SystemRoot ?? 'C:\\Windows', 'System32')] : ['/usr/bin', '/bin']
const PATH_LIMPO = [dirname(process.execPath), ...SYS_DIRS].join(delimiter)
const ENV_LIMPO = WIN
  ? { Path: PATH_LIMPO, SystemRoot: process.env.SystemRoot ?? 'C:\\Windows', ComSpec: process.env.ComSpec ?? 'C:\\Windows\\System32\\cmd.exe' }
  : { PATH: PATH_LIMPO }

describe('aidlc-gate: executáveis do kit no PATH dos gates', () => {
  test('um gate que chama aidlc-scan o acha mesmo com o PATH sem o kit (não dá 127)', () => {
    const dir = projeto('aidlc-scan relatorio-que-nao-existe.json')
    const r = spawnSync(process.execPath, [GATE], { cwd: dir, encoding: 'utf8', env: ENV_LIMPO })
    rmSync(dir, { recursive: true, force: true })
    const saida = r.stdout + r.stderr
    assert.doesNotMatch(saida, /not found|exit 127/, saida)
    // o scan rodou de verdade e disse "nao rodou", que e o resultado certo para arquivo ausente
    assert.match(saida, /NAO RODOU/)
    assert.equal(r.status, 1)
  })

  test('o PATH do usuário continua valendo depois do kit (comando comum ainda roda)', () => {
    const dir = projeto('echo ok-do-usuario')
    const r = spawnSync(process.execPath, [GATE], { cwd: dir, encoding: 'utf8', env: ENV_LIMPO })
    rmSync(dir, { recursive: true, force: true })
    assert.match(r.stdout + r.stderr, /PASSOU/)
    assert.equal(r.status, 0)
  })

  test('mutante: falha ao abrir o shell do gate sai como erro ao iniciar, nunca como falso timeout', () => {
    const dir = projeto('echo ok')
    const envSemShell = WIN
      ? { ...ENV_LIMPO, ComSpec: join(dir, 'shell-inexistente.exe') }
      : { ...ENV_LIMPO, SHELL: join(dir, 'shell-inexistente') }
    const r = spawnSync(process.execPath, [GATE], { cwd: dir, encoding: 'utf8', env: envSemShell })
    rmSync(dir, { recursive: true, force: true })
    const saida = r.stdout + r.stderr
    assert.equal(r.status, 1)
    assert.match(saida, /erro ao iniciar/)
    assert.doesNotMatch(saida, /exit timeout/)
  })
})

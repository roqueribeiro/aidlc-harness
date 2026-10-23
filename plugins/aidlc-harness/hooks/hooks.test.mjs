#!/usr/bin/env node
/*
 * Suite dos hooks. Roda no CI e antes de qualquer release do plugin.
 *
 * Os hooks disparam a cada turno de toda sessao de todo o projeto: um bug aqui nao quebra
 * um repo, quebra o dia inteiro. Entao cada um e testado nos dois sentidos (bloqueia quando
 * deve, libera quando deve) e a latencia e medida, porque um hook lento no Stop e um imposto
 * cobrado dezenas de vezes por sessao.
 */

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HOOKS = join(fileURLToPath(new URL('.', import.meta.url)))
const BUDGET_MS = 400 // teto por invocacao, com folga pro CI compartilhado

function runHook(name, payload, env = {}) {
  const started = Date.now()
  const r = spawnSync(process.execPath, [join(HOOKS, name)], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, ...env },
    timeout: 20000,
  })
  return { code: r.status, out: r.stdout ?? '', err: r.stderr ?? '', ms: Date.now() - started }
}

/** Repo git de mentira, com os marcadores que a deteccao procura. */
function fixtureRepo(kind) {
  const dir = mkdtempSync(join(tmpdir(), `aidlc-hooktest-${kind}-`))
  execFileSync('git', ['init', '-q'], { cwd: dir })
  execFileSync('git', ['config', 'user.email', 't@t.t'], { cwd: dir })
  execFileSync('git', ['config', 'user.name', 't'], { cwd: dir })

  if (kind === 'yarn') {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'amostra', scripts: { test: 'node --test' } }))
    writeFileSync(join(dir, 'yarn.lock'), '# yarn lockfile v1\n')
  } else if (kind === 'npm') {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'amostra', scripts: { test: 'node --test' } }))
    writeFileSync(join(dir, 'package-lock.json'), '{}')
  } else if (kind === 'nuxt' || kind === 'nuxt-yarn') {
    // Manifesto npm (package-lock.json), mas o repo pode declarar yarn no packageManager.
    const pkg = { name: 'amostra' }
    if (kind === 'nuxt-yarn') pkg.packageManager = 'yarn@1.22.22'
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
    writeFileSync(join(dir, 'package-lock.json'), '{}')
  } else {
    writeFileSync(join(dir, 'readme.txt'), 'nada reconhecivel\n')
  }

  writeFileSync(join(dir, 'seed.txt'), 'seed\n')
  execFileSync('git', ['add', '-A'], { cwd: dir })
  execFileSync('git', ['commit', '-qm', 'seed'], { cwd: dir })
  return dir
}

/*
 * O transcript vai FORA do repo de propriedade: na vida real ele mora em ~/.claude/projects/,
 * e escrever dentro da fixture o faria contar como arquivo novo, o que sozinho ja dispararia
 * o gate de evidencia e mascararia o caso "nada foi alterado".
 */
function transcript(dir, turns) {
  const box = mkdtempSync(join(tmpdir(), 'aidlc-transcript-'))
  const p = join(box, 'transcript.jsonl')
  writeFileSync(p, turns.map((t) => JSON.stringify(t)).join('\n') + '\n')
  return p
}

/*
 * Id de sessao unico por invocacao E por execucao.
 *
 * O contador anti-loop do dod-check e o livro-caixa do strategy-map vivem em tmp com TTL de
 * seis horas, entao um id fixo faria o teste depender da ordem em que rodou. So o `pid` nao
 * basta: o sistema REUSA pid, e duas rodadas da suite com o mesmo numero herdavam o estado
 * uma da outra. O sintoma foi 7 falhas intermitentes que nao reproduziam sozinhas, e a causa
 * e a mesma que o comentario do dod-check ja descrevia sobre id de sessao reaproveitado.
 */
const RUN = `${process.pid}-${Date.now().toString(36)}`
let sidN = 0
const sid = () => `t-${RUN}-${++sidN}`

const userMsg = (text) => ({ type: 'user', message: { role: 'user', content: text } })
const asstMsg = (text) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text }] } })

// ---------------------------------------------------------------------------

describe('pkg-manager', () => {
  test('bloqueia npm num repo yarn e explica a fonte', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('pkg-manager.mjs', { cwd: dir, tool_input: { command: 'npm install lodash' } })
    assert.equal(r.code, 2, 'deveria negar')
    assert.match(r.err, /yarn/)
    assert.match(r.err, /quality\/node-yarn\.json/, 'precisa dizer de onde veio a regra')
    rmSync(dir, { recursive: true, force: true })
  })

  test('LIBERA npm num repo npm, que era o falso positivo do hook antigo', () => {
    const dir = fixtureRepo('npm')
    for (const cmd of ['npm start', 'npx cap sync', 'npm run build:appx']) {
      const r = runHook('pkg-manager.mjs', { cwd: dir, tool_input: { command: cmd } })
      assert.equal(r.code, 0, `${cmd} deveria passar num repo npm`)
    }
    rmSync(dir, { recursive: true, force: true })
  })

  test('libera quando nao reconhece a tecnologia', () => {
    const dir = fixtureRepo('none')
    const r = runHook('pkg-manager.mjs', { cwd: dir, tool_input: { command: 'npm install' } })
    assert.equal(r.code, 0)
    rmSync(dir, { recursive: true, force: true })
  })

  test('nao bloqueia yarn num repo yarn', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('pkg-manager.mjs', { cwd: dir, tool_input: { command: 'yarn lint' } })
    assert.equal(r.code, 0)
    rmSync(dir, { recursive: true, force: true })
  })

  /*
   * O guard nao pode julgar pelo cwd da SESSAO. Uma sessao aberta num repo yarn que rodasse
   * `cd ../outro-repo && npm ci` seria negada pelo manifesto do repo da sessao, citando um repo
   * que o comando nao toca. Quem manda e o diretorio onde o comando roda.
   */
  test('segue o `cd` e julga pelo repo de destino, nao pelo da sessao', () => {
    const yarnRepo = fixtureRepo('yarn')
    const npmRepo = fixtureRepo('npm')

    const liberado = runHook('pkg-manager.mjs', {
      cwd: yarnRepo,
      tool_input: { command: `cd ${npmRepo} && npm ci` },
    })
    assert.equal(liberado.code, 0, 'npm no repo npm passa, mesmo com a sessao num repo yarn')

    const negado = runHook('pkg-manager.mjs', {
      cwd: npmRepo,
      tool_input: { command: `cd ${yarnRepo} && npm install lodash` },
    })
    assert.equal(negado.code, 2, 'npm no repo yarn continua negado, mesmo com a sessao num repo npm')
    assert.match(negado.err, /quality\/node-yarn\.json/)
    assert.match(negado.err, /Diretorio julgado/, 'precisa dizer qual diretorio pesou na decisao')

    rmSync(yarnRepo, { recursive: true, force: true })
    rmSync(npmRepo, { recursive: true, force: true })
  })

  /*
   * A quebra de linha e separador de comando tanto quanto `;`. Sem ela na divisao, num
   * script de varias linhas o `cd` ficava grudado no fim da linha anterior, o segmento nao
   * COMECAVA com `cd`, e o rastreio nao via a troca de diretorio: o guard voltava a julgar
   * pelo repo da sessao.
   */
  test('rastreia `cd` que vem em linha propria', () => {
    const yarnRepo = fixtureRepo('yarn')
    const npmRepo = fixtureRepo('npm')

    const r = runHook('pkg-manager.mjs', {
      cwd: yarnRepo,
      tool_input: { command: `sleep 1\ncd ${npmRepo}\nnpm ci` },
    })
    assert.equal(r.code, 0, 'o cd em linha propria precisa ser rastreado como qualquer outro')

    const negado = runHook('pkg-manager.mjs', {
      cwd: npmRepo,
      tool_input: { command: `echo oi\ncd ${yarnRepo}\nnpm ci` },
    })
    assert.equal(negado.code, 2, 'e continua negando quando o destino e um repo yarn')

    rmSync(yarnRepo, { recursive: true, force: true })
    rmSync(npmRepo, { recursive: true, force: true })
  })

  /*
   * Corpo de heredoc e DADO, nao comando.
   *
   * Caso tipico: escrever um Dockerfile de um projeto npm de terceiro de dentro de um repo
   * yarn. O heredoc leva a linha
   *
   *     RUN npm install --no-audit && npm run dist && cd dist && npm install --omit=dev
   *
   * e o guard, que divide por `&&` e olha o inicio do segmento, viu tres invocacoes de npm
   * num repo yarn e negou a escrita do ARQUIVO. Nenhum npm ia rodar ali: o unico comando
   * era `cat`. Um guard que impede escrever a palavra `npm` num arquivo nao esta guardando
   * gerenciador de pacote, esta guardando texto -- e o falso positivo ensina a desligar o
   * guard, que e o pior desfecho possivel para ele.
   */
  test('ignora o corpo de heredoc, que e dado e nao comando', () => {
    const yarnRepo = fixtureRepo('yarn')

    const comHeredoc = [
      "cat > Dockerfile <<'EOF'",
      'FROM node:20',
      'RUN npm install --no-audit --no-fund && npm run dist',
      'EOF',
      'echo pronto',
    ].join('\n')

    const r = runHook('pkg-manager.mjs', { cwd: yarnRepo, tool_input: { command: comHeredoc } })
    assert.equal(r.code, 0, 'npm dentro de heredoc e conteudo de arquivo, nao invocacao')

    // E o guard nao pode ficar cego: um npm de VERDADE depois do heredoc ainda e negado.
    const depois = [
      "cat > nota.txt <<'EOF'",
      'npm install isto aqui e so texto',
      'EOF',
      'npm install lodash',
    ].join('\n')

    const negado = runHook('pkg-manager.mjs', { cwd: yarnRepo, tool_input: { command: depois } })
    assert.equal(negado.code, 2, 'o comando real depois do heredoc continua sendo julgado')

    rmSync(yarnRepo, { recursive: true, force: true })
  })

  /*
   * Mesma raiz do heredoc, outra porta: `node -e "…"` e UM comando, e o que vai entre aspas
   * e argumento. Cortando por `&&` sem olhar aspas, o guard inventava um segmento comecando
   * por `npm` e negava um `node` legitimo, por exemplo ao escrever um CHANGELOG que FALA sobre npm.
   */
  test('nao corta dentro de aspas: npm em argumento nao e invocacao', () => {
    const yarnRepo = fixtureRepo('yarn')

    for (const cmd of [
      `node -e "console.log('rode npm install && npm run dist')"`,
      `echo 'npm ci quebrou aqui' > nota.txt`,
      `git commit -m "fix: trocar npm install por yarn"`,
    ]) {
      const r = runHook('pkg-manager.mjs', { cwd: yarnRepo, tool_input: { command: cmd } })
      assert.equal(r.code, 0, `${cmd.slice(0, 40)}… nao invoca npm nenhum`)
    }

    // E o npm de verdade continua negado, inclusive colado num comando com aspas.
    const negado = runHook('pkg-manager.mjs', {
      cwd: yarnRepo,
      tool_input: { command: `echo "preparando" && npm install lodash` },
    })
    assert.equal(negado.code, 2, 'invocacao real fora das aspas continua sendo julgada')

    rmSync(yarnRepo, { recursive: true, force: true })
  })

  test('aceita `cd` relativo e com aspas', () => {
    const yarnRepo = fixtureRepo('yarn')
    const npmRepo = fixtureRepo('npm')
    const relativo = `../${basename(npmRepo)}`

    for (const alvo of [relativo, `"${relativo}"`, `'${relativo}'`]) {
      const r = runHook('pkg-manager.mjs', {
        cwd: yarnRepo,
        tool_input: { command: `cd ${alvo} && npm ci` },
      })
      assert.equal(r.code, 0, `cd ${alvo} deveria resolver para o repo npm`)
    }

    rmSync(yarnRepo, { recursive: true, force: true })
    rmSync(npmRepo, { recursive: true, force: true })
  })

  /*
   * Um repo com lockfile npm que passou a declarar `packageManager: yarn@1.22.22`: o guard
   * mandava usar npm nele e regenerar o package-lock. O que o repo declara vence o da stack.
   */
  test('o packageManager do repo vence o gerenciador da stack', () => {
    const site = fixtureRepo('nuxt-yarn')
    assert.equal(runHook('pkg-manager.mjs', { cwd: site, tool_input: { command: 'yarn install --frozen-lockfile' } }).code, 0)
    const negado = runHook('pkg-manager.mjs', { cwd: site, tool_input: { command: 'npm install lodash' } })
    assert.equal(negado.code, 2, 'npm num repo que declara yarn')
    assert.match(negado.err, /packageManager do package\.json/, 'precisa dizer de onde veio a regra')
    rmSync(site, { recursive: true, force: true })
  })

  test('sem packageManager, vale o da stack', () => {
    const projeto = fixtureRepo('nuxt')
    assert.equal(runHook('pkg-manager.mjs', { cwd: projeto, tool_input: { command: 'npm ci' } }).code, 0)
    const negado = runHook('pkg-manager.mjs', { cwd: projeto, tool_input: { command: 'yarn add lodash' } })
    assert.equal(negado.code, 2)
    assert.match(negado.err, /quality\/node-npm\.json/)
    rmSync(projeto, { recursive: true, force: true })
  })

  /* Rastreio perdido nao pode virar bloqueio: na duvida sobre ONDE roda, o guard libera. */
  test('libera quando o `cd` nao e rastreavel', () => {
    const dir = fixtureRepo('yarn')
    for (const cmd of ['cd - && npm ci', 'cd && npm ci']) {
      const r = runHook('pkg-manager.mjs', { cwd: dir, tool_input: { command: cmd } })
      assert.equal(r.code, 0, `${cmd} deveria liberar por falta de certeza`)
    }
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('secret-guard', () => {
  const blocked = [
    'cat ~/.ssh/id_ed25519',
    'security find-generic-password -s aidlc.github-token -w',
    'echo $GITHUB_TOKEN',
    'cat .env',
    'gh auth token',
    'printenv',
  ]
  for (const cmd of blocked) {
    test(`bloqueia: ${cmd}`, () => {
      const r = runHook('secret-guard.mjs', { tool_input: { command: cmd } })
      assert.equal(r.code, 2, `${cmd} deveria ser negado`)
      assert.match(r.err, /Use:/)
    })
  }

  /*
   * Falsos positivos reais ao configurar um .env. `\b` casa entre o ponto e o "e" de `.env`, entao QUALQUER comando terminado
   * no nome do arquivo era lido como `env`. E o `.env.example` e versionado de proposito:
   * ele carrega o nome de cada variavel e onde achar o valor, nunca o valor.
   *
   * Guarda que nega o comando que apenas CITA o arquivo nao protege nada, e a pessoa
   * aprende a contornar a guarda inteira. Isso custa mais que o falso positivo.
   */
  const allowed = [
    'git status',
    'yarn lint',
    'ssh root@host docker ps',
    'cat README.md',
    'aidlc-secrets status',
    'git check-ignore -v .env',
    'ls -la .env',
    'test -f .env && echo existe',
    'cat .env.example',
    'cp .env.example .env',
  ]
  for (const cmd of allowed) {
    test(`libera: ${cmd}`, () => {
      const r = runHook('secret-guard.mjs', { tool_input: { command: cmd } })
      assert.equal(r.code, 0, `${cmd} deveria passar`)
    })
  }

  test('respeita o kill switch', () => {
    const r = runHook('secret-guard.mjs', { tool_input: { command: 'cat ~/.ssh/id_rsa' } }, { AIDLC_SECRET_GUARD: '0' })
    assert.equal(r.code, 0)
  })
})


describe('dod-check', () => {
  test('libera quando nada foi alterado, porque nao houve entrega a provar', () => {
    const dir = fixtureRepo('yarn')
    const tp = transcript(dir, [userMsg('faz ai'), asstMsg('feito')])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() })
    assert.equal(r.code, 0)
    rmSync(dir, { recursive: true, force: true })
  })

  test('BLOQUEIA quando alterou codigo e nao mostrou evidencia', () => {
    const dir = fixtureRepo('yarn')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src/Novo.js'), '<template><div /></template>\n')
    const tp = transcript(dir, [userMsg('cria o componente'), asstMsg('Pronto, criei o componente.')])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() })
    assert.equal(r.code, 2, 'deveria recusar o encerramento')
    assert.match(r.err, /Falta evidencia/)
    assert.match(r.err, /Saida do gate colada no chat/, 'a evidencia do gate foi exigida porque tocou codigo')
    rmSync(dir, { recursive: true, force: true })
  })

  test('libera quando a evidencia aparece no chat', () => {
    const dir = fixtureRepo('yarn')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src/Novo.js'), '<template><div /></template>\n')
    const tp = transcript(dir, [
      userMsg('cria o componente'),
      asstMsg(
        [
          'yarn test',
          '# tests 12',
          '# pass 12',
          '# fail 0',
        ].join('\n'),
      ),
    ])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() })
    assert.equal(r.code, 0, r.err)
    rmSync(dir, { recursive: true, force: true })
  })

  /*
   * Fechamento de unidade: com a arvore limpa o hook liberava sem olhar, e e
   * exatamente com a arvore limpa que uma unidade fecha. A evidencia `whenSays` da camada org
   * cobra a limpeza quando o turno afirma o fechamento.
   */
  test('BLOQUEIA "unidade fechada" sem aidlc-limpeza, mesmo com a arvore limpa', () => {
    const dir = fixtureRepo('yarn')
    const tp = transcript(dir, [userMsg('segue as unidades'), asstMsg('Unidade 12 fechada: producao e main atualizadas.')])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() })
    assert.equal(r.code, 2, 'afirmou fechar e nao mostrou a limpeza')
    assert.match(r.err, /aidlc-limpeza/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('libera "unidade fechada" com a linha do aidlc-limpeza', () => {
    const dir = fixtureRepo('yarn')
    const tp = transcript(dir, [userMsg('segue as unidades'), asstMsg('aidlc-limpeza: nada sobrando'), asstMsg('Unidade 12 fechada.')])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() })
    assert.equal(r.code, 0, r.err)
    rmSync(dir, { recursive: true, force: true })
  })

  test('nao exige evidencia condicional quando o arquivo tocado nao casa o glob', () => {
    const dir = fixtureRepo('yarn')
    writeFileSync(join(dir, 'notas.md'), 'so uma nota\n')
    const tp = transcript(dir, [
      userMsg('anota isso'),
      asstMsg('yarn lint\n12 passed\nsmoke /app 200 /docs 200'),
    ])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() })
    assert.equal(r.code, 0, r.err)
    rmSync(dir, { recursive: true, force: true })
  })

  test('respeita o kill switch', () => {
    const dir = fixtureRepo('yarn')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src/X.js'), 'x\n')
    const tp = transcript(dir, [userMsg('faz'), asstMsg('feito')])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() }, { AIDLC_GATE: '0' })
    assert.equal(r.code, 0)
    rmSync(dir, { recursive: true, force: true })
  })

  test('teto anti-loop: depois de 3 bloqueios vira aviso', () => {
    const dir = fixtureRepo('yarn')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src/Y.js'), 'y\n')
    const tp = transcript(dir, [userMsg('faz'), asstMsg('feito')])
    const s2 = sid()
    const codes = []
    for (let i = 0; i < 5; i++) {
      codes.push(runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: s2 }).code)
    }
    assert.deepEqual(codes.slice(0, 3), [2, 2, 2], 'os tres primeiros bloqueiam')
    assert.deepEqual(codes.slice(3), [0, 0], 'depois do teto, libera')
    rmSync(dir, { recursive: true, force: true })
  })

  /*
   * Trilha de auditoria que sobrevive. Antes
   * o que autorizou uma entrega vivia no transcript e num contador em tmp com TTL de 6h.
   * Agora cada decisao do gate vira uma linha em .claude/audit/<dia>.jsonl do repo, com a
   * versao do kit e o hash do manifesto: duas runs sob criterios diferentes ficam
   * distinguiveis depois.
   */
  test('grava a decisao em .claude/audit com versao do kit e hash do manifesto', () => {
    const dir = fixtureRepo('yarn')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src/Z.js'), 'z\n')
    const tp = transcript(dir, [userMsg('faz'), asstMsg('feito')])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() })
    assert.equal(r.code, 2)
    const auditDir = join(dir, '.claude', 'audit')
    const files = readdirSync(auditDir).filter((f) => f.endsWith('.jsonl'))
    assert.equal(files.length, 1, 'um arquivo por dia')
    const rec = JSON.parse(readFileSync(join(auditDir, files[0]), 'utf8').trim().split('\n').at(-1))
    assert.equal(rec.decision, 'blocked')
    assert.equal(rec.tech, 'node-yarn')
    assert.match(rec.kitVersion, /^\d+\.\d+\.\d+$/, 'versao do plugin carimbada')
    assert.match(rec.manifestHash, /^[0-9a-f]{12}$/, 'hash do manifesto carimbado')
    assert.ok(rec.missing.length > 0)
    rmSync(dir, { recursive: true, force: true })
  })

  test('AIDLC_AUDIT=0 desliga so o registro, nunca o gate', () => {
    const dir = fixtureRepo('yarn')
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src/W.js'), 'w\n')
    const tp = transcript(dir, [userMsg('faz'), asstMsg('feito')])
    const r = runHook('dod-check.mjs', { cwd: dir, transcript_path: tp, session_id: sid() }, { AIDLC_AUDIT: '0' })
    assert.equal(r.code, 2, 'o gate continua barrando')
    assert.equal(existsSync(join(dir, '.claude', 'audit')), false)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('gate_mode vale para os hooks de Stop', () => {
  /*
   * Se so um hook lesse CLAUDE_PLUGIN_OPTION_GATE_MODE, com `off` na tela do plugin os outros
   * hooks de Stop continuariam recusando, e a descricao do campo diria "desligado". Uma
   * configuracao, uma leitura: a funcao vive em lib/gate-mode.
   */
  test('promise-check libera com gate_mode=off', () => {
    const r = runHook('promise-check.mjs', { last_assistant_message: 'Sigo no loop pelas pendencias.' }, { CLAUDE_PLUGIN_OPTION_GATE_MODE: 'off' })
    assert.equal(r.code, 0)
  })

  test('valor desconhecido cai em block, que e o lado seguro', () => {
    const r = runHook('promise-check.mjs', { last_assistant_message: 'Sigo no loop pelas pendencias.' }, { CLAUDE_PLUGIN_OPTION_GATE_MODE: 'banana' })
    assert.equal(r.code, 2)
  })
})


describe('session-brief', () => {
  test('injeta a stack, o gate e a evidencia', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('session-brief.mjs', { cwd: dir })
    assert.equal(r.code, 0)
    const p = JSON.parse(r.out)
    assert.match(p.hookSpecificOutput.additionalContext, /Node \(yarn\)/)
    assert.match(p.hookSpecificOutput.additionalContext, /aidlc-gate/)
    assert.match(p.hookSpecificOutput.additionalContext, /AIDLC_GATE=0/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('sai calado onde nao reconhece a stack', () => {
    const dir = fixtureRepo('none')
    const r = runHook('session-brief.mjs', { cwd: dir })
    assert.equal(r.code, 0)
    assert.equal(r.out.trim(), '')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('scratch-guard', () => {
  /*
   * Opt-in: o hook só age quando o projeto declara `scratchDir`. O teste guarda os dois sentidos:
   * nega a escrita que suja o home, e NÃO nega a leitura (guarda que nega o comando que apenas
   * cita o arquivo não protege nada e ensina a desligar a guarda inteira).
   */
  const MAC = { HOME: '/Users/fulano' }
  const projetoComScratch = () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-scratch-'))
    mkdirSync(join(d, '.aidlc'), { recursive: true })
    writeFileSync(join(d, '.aidlc', 'config.json'), JSON.stringify({ scratchDir: '~/workspaces/scratch' }))
    return d
  }
  const CWD = projetoComScratch()
  const roda = (tool_input, env = MAC, cwd = CWD) => runHook('scratch-guard.mjs', { tool_input, cwd }, env)

  const bloqueados = [
    ['arquivo solto na raiz do home', { file_path: '~/nohup.out' }],
    ['pasta de tema criada no home', { file_path: '~/diagnostico/wifi.py' }],
    ['caminho absoluto do macOS', { file_path: '/Users/fulano/testa-cofre.mjs' }],
    ['redirecionamento pela ponte do Cowork', { command: 'echo oi > $HOME/mnt/fulano/teste.sh' }],
    ['mkdir de tema novo no home', { command: 'mkdir -p ~/diagnostico' }],
    ['cp com destino no home', { command: 'cp relatorio.md ~/relatorio.md' }],
  ]
  for (const [nome, tool_input] of bloqueados) {
    test(`bloqueia: ${nome}`, () => {
      const r = roda(tool_input)
      assert.equal(r.code, 2, `${JSON.stringify(tool_input)} deveria ser negado`)
      assert.match(r.err, /workspaces\/scratch/)
    })
  }

  const liberados = [
    ['o destino que o próprio hook manda usar', { file_path: '~/workspaces/scratch/diagnostico/wifi.py' }],
    ['arquivo dentro de um repo do projeto', { file_path: '/Users/fulano/workspaces/repos/app-exemplo/src/a.js' }],
    ['dotfile de ferramenta', { file_path: '~/.config/aidlc/config.json' }],
    ['pasta que já tem dono', { file_path: '~/Downloads/nota.pdf' }],
    ['área de entrega do Cowork', { file_path: '/mnt/user-data/outputs/relatorio.md' }],
    ['LER do home', { command: 'cat ~/diagnostico/wifi.py' }],
    ['procurar no home', { command: 'grep -rn foo ~/diagnostico/' }],
    ['listar o home', { command: 'ls -la ~/' }],
  ]
  for (const [nome, tool_input] of liberados) {
    test(`libera: ${nome}`, () => {
      const r = roda(tool_input)
      assert.equal(r.code, 0, `${JSON.stringify(tool_input)} deveria passar: ${r.err}`)
    })
  }

  test('sem scratchDir declarado, o hook não age (opt-in)', () => {
    const vazio = mkdtempSync(join(tmpdir(), 'aidlc-scratch-vazio-'))
    assert.equal(roda({ file_path: '~/nohup.out' }, MAC, vazio).code, 0)
    rmSync(vazio, { recursive: true, force: true })
  })

  test('a variável AIDLC_SCRATCH_DIR também liga o hook', () => {
    const vazio = mkdtempSync(join(tmpdir(), 'aidlc-scratch-env-'))
    const r = roda({ file_path: '~/nohup.out' }, { ...MAC, AIDLC_SCRATCH_DIR: '~/rascunhos' }, vazio)
    assert.equal(r.code, 2)
    assert.match(r.err, /~\/rascunhos/)
    rmSync(vazio, { recursive: true, force: true })
  })

  test('scratchDir fora do formato ~/pasta é ignorado', () => {
    const d = mkdtempSync(join(tmpdir(), 'aidlc-scratch-ruim-'))
    mkdirSync(join(d, '.aidlc'), { recursive: true })
    writeFileSync(join(d, '.aidlc', 'config.json'), JSON.stringify({ scratchDir: '/etc' }))
    assert.equal(roda({ file_path: '~/nohup.out' }, MAC, d).code, 0)
    rmSync(d, { recursive: true, force: true })
  })

  /*
   * Dentro de um container, `~` é outro diretório: rascunho que morre com a sessão e não suja casa
   * nenhuma. Só o mount aponta para a máquina da pessoa.
   */
  test('no container, o próprio scratch passa', () => {
    assert.equal(roda({ file_path: '~/scratch.py' }, { HOME: '/home/sessao' }).code, 0)
  })

  test('no container, o home da pessoa pela ponte continua barrado', () => {
    assert.equal(roda({ file_path: '/sessions/abc/mnt/fulano/lixo.sh' }, { HOME: '/home/sessao' }).code, 2)
  })

  test('respeita o kill switch', () => {
    assert.equal(roda({ file_path: '~/lixo.sh' }, { ...MAC, AIDLC_SCRATCH_GUARD: '0' }).code, 0)
  })
})

describe('robustez e latencia', () => {
  const all = ['pkg-manager.mjs', 'secret-guard.mjs', 'scratch-guard.mjs', 'dod-check.mjs', 'session-brief.mjs', 'promise-check.mjs']

  for (const h of all) {
    test(`${h} nao explode com stdin lixo`, () => {
      const r = runHook(h, undefined)
      assert.ok(r.code === 0 || r.code === 2, `saiu com ${r.code}`)
    })
  }

  test(`todo hook responde abaixo de ${BUDGET_MS}ms`, () => {
    const dir = fixtureRepo('yarn')
    const tp = transcript(dir, [userMsg('oi'), asstMsg('ola')])
    const rows = all.map((h) => ({ h, ms: runHook(h, { cwd: dir, transcript_path: tp, session_id: 'perf' }).ms }))
    for (const r of rows) console.log(`      ${r.h.padEnd(22)} ${String(r.ms).padStart(4)}ms`)
    const slow = rows.filter((r) => r.ms > BUDGET_MS)
    assert.equal(slow.length, 0, `lentos: ${slow.map((s) => `${s.h}=${s.ms}ms`).join(', ')}`)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('promise-check', () => {
  /*
   * Este hook nasceu de duas cobrancas da pessoa responsável no mesmo dia: eu escrevi no
   * OPERATING-MODEL que entrega termina em verde e nao em relatorio, e quebrei a regra que
   * tinha acabado de escrever. Documento nao muda comportamento; mecanismo muda.
   *
   * Os casos abaixo sao os fechos REAIS que motivaram a cobranca, e os que NAO podem
   * bloquear. O segundo grupo importa tanto quanto o primeiro: punir relato honesto de
   * pendencia ensina a esconder pendencia, e punir quem cola a saida de uma ferramenta
   * ensina a nao colar prova, que e o oposto do que este kit inteiro existe para conseguir.
   */
  test('bloqueia o fecho que promete seguir', () => {
    const r = runHook('promise-check.mjs', {
      last_assistant_message: 'Gate verde, commit no origin. Sigo no loop pelas pendencias do backoffice.',
    })
    assert.equal(r.code, 2)
    assert.match(r.err, /PROMETE continuar/)
  })

  test('bloqueia "proximo alvo", que e a mesma promessa com outro nome', () => {
    const r = runHook('promise-check.mjs', {
      last_assistant_message: 'Kit publicado. Proximo alvo: as barras de navegacao restantes.',
    })
    assert.equal(r.code, 2)
  })

  test('deixa passar pendencia declarada como FATO', () => {
    const r = runHook('promise-check.mjs', {
      last_assistant_message: 'Deploy verificado. Fica em aberto o prune, porque a credencial expirou e exige sessao interativa.',
    })
    assert.equal(r.code, 0)
  })

  test('deixa passar promessa condicionada aa pessoa responsável', () => {
    const r = runHook('promise-check.mjs', {
      last_assistant_message: 'O arquivo de configuracao nao existe. Quando voce disser, eu crio o config.ts.',
    })
    assert.equal(r.code, 0)
  })

  test('nao pune quem cola a prova: promessa citada em bloco de codigo', () => {
    // Falso positivo real: o hook bloqueou um turno porque a mensagem CITAVA a saida de
    // teste dele mesmo. Ele leu a evidencia de que funcionava como se fosse a infracao.
    const r = runHook('promise-check.mjs', {
      last_assistant_message: 'Testei e funciona:\n\n```\n"Sigo no loop" -> exit 2 (bloqueado)\n```\n\nTudo verde e em producao.',
    })
    assert.equal(r.code, 0)
  })

  test('deixa passar fecho limpo', () => {
    const r = runHook('promise-check.mjs', {
      last_assistant_message: 'Os dois repos em 100/100. Gate verde, evidencia colada, producao verificada.',
    })
    assert.equal(r.code, 0)
  })

  test('respeita o kill switch', () => {
    const r = runHook('promise-check.mjs', {
      last_assistant_message: 'Sigo no loop.',
    }, { AIDLC_PROMISE: '0' })
    assert.equal(r.code, 0)
  })
})

describe('strategy-map (UserPromptSubmit)', () => {
  /*
   * Este hook existe porque, sem ele, o kit fala no SessionStart, volta a falar no Stop, e no
   * meio, onde o codigo nasce, fica mudo. UserPromptSubmit e um
   * dos tres eventos onde a documentacao GARANTE que o texto entra no contexto do modelo,
   * entao e por ele que a estrategia volta depois de um /compact.
   */
  const ctx = (r) => {
    assert.equal(r.code, 0)
    const o = JSON.parse(r.out || '{}')
    return o.hookSpecificOutput?.additionalContext ?? ''
  }

  test('primeiro prompt traz o mapa completo, com rule, revisor e skills', () => {
    const dir = fixtureRepo('yarn')
    const c = ctx(runHook('strategy-map.mjs', { cwd: dir, session_id: sid(), prompt: 'oi' }))
    assert.match(c, /Node \(yarn\)/)
    assert.match(c, /Leia antes de escrever/)
    assert.match(c, /supply-chain-reviewer/)
    assert.match(c, /Skills do kit/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('prompt seguinte encolhe: o mapa inteiro a cada turno seria imposto', () => {
    const dir = fixtureRepo('yarn')
    const s = sid()
    const primeiro = ctx(runHook('strategy-map.mjs', { cwd: dir, session_id: s, prompt: 'a' }))
    const segundo = ctx(runHook('strategy-map.mjs', { cwd: dir, session_id: s, prompt: 'b' }))
    assert.ok(segundo.length < primeiro.length, `curto (${segundo.length}) deveria ser menor que completo (${primeiro.length})`)
    assert.match(segundo, /supply-chain-reviewer/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('tecnologia nao reconhecida sai calado, nunca inventa contexto', () => {
    const dir = fixtureRepo('nenhuma')
    const r = runHook('strategy-map.mjs', { cwd: dir, session_id: sid(), prompt: 'oi' })
    assert.equal(r.code, 0)
    assert.equal(r.out.trim(), '')
    rmSync(dir, { recursive: true, force: true })
  })

  test('respeita o kill switch', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('strategy-map.mjs', { cwd: dir, session_id: sid(), prompt: 'oi' }, { AIDLC_STRATEGY: '0' })
    assert.equal(r.out.trim(), '')
    rmSync(dir, { recursive: true, force: true })
  })

  test('cabe no orcamento de latencia', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('strategy-map.mjs', { cwd: dir, session_id: sid(), prompt: 'oi' })
    assert.ok(r.ms < BUDGET_MS, `${r.ms}ms acima do teto de ${BUDGET_MS}ms`)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('path-strategy (PostToolUse)', () => {
  /*
   * O roteador. Entrega a rule daquele caminho, o raio cross-repo quando o arquivo e
   * contrato, e o revisor que a stack exige. Cada ponteiro sai UMA vez por sessao: repetir a
   * mesma linha a cada save e o caminho mais curto pra alguem desligar o hook.
   */
  const ctx = (r) => {
    assert.equal(r.code, 0)
    const o = JSON.parse(r.out || '{}')
    return o.hookSpecificOutput?.additionalContext ?? ''
  }
  const edit = (dir, rel, s) => ({ cwd: dir, session_id: s, tool_name: 'Edit', tool_input: { file_path: join(dir, rel) } })

  test('caminho governado por rule devolve a rule, o porque e o revisor', () => {
    const dir = fixtureRepo('yarn')
    const c = ctx(runHook('path-strategy.mjs', edit(dir, 'package.json', sid())))
    assert.match(c, /dependencies\.md/)
    assert.match(c, /registry/)
    assert.match(c, /supply-chain-reviewer/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('mesmo ponteiro nao sai duas vezes na mesma sessao', () => {
    const dir = fixtureRepo('yarn')
    const s = sid()
    const um = runHook('path-strategy.mjs', edit(dir, 'src/A.js', s))
    const dois = runHook('path-strategy.mjs', edit(dir, 'src/A.js', s))
    assert.ok(um.out.trim().length > 0)
    assert.equal(dois.out.trim(), '')
    rmSync(dir, { recursive: true, force: true })
  })

  test('arquivo sem recorte de estrategia sai calado', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('path-strategy.mjs', edit(dir, 'CHANGELOG.md', sid()))
    assert.equal(r.code, 0)
    assert.equal(r.out.trim(), '')
    rmSync(dir, { recursive: true, force: true })
  })

  test('arquivo fora do repo da sessao nao e assunto deste manifesto', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('path-strategy.mjs', { cwd: dir, session_id: sid(), tool_input: { file_path: '/tmp/qualquer/outro.vue' } })
    assert.equal(r.out.trim(), '')
    rmSync(dir, { recursive: true, force: true })
  })

  test('o que ele entrega fica no livro-caixa e o strategy-map reentrega no prompt seguinte', () => {
    /*
     * O ponto do teste: `additionalContext` no PostToolUse NAO e documentado. Se o runtime
     * ignorar, o ponteiro ainda precisa chegar. Este e o caminho que garante isso.
     */
    const dir = fixtureRepo('yarn')
    const s = sid()
    runHook('strategy-map.mjs', { cwd: dir, session_id: s, prompt: 'primeiro' })
    const roteado = ctx(runHook('path-strategy.mjs', edit(dir, 'src/stores/foo.js', s)))
    assert.match(roteado, /testing\.md/)
    const proximo = ctx(runHook('strategy-map.mjs', { cwd: dir, session_id: s, prompt: 'segundo' }))
    assert.match(proximo, /Pendente desde a ultima edicao/)
    assert.match(proximo, /testing\.md/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('nao repete a pendencia depois de entregue', () => {
    const dir = fixtureRepo('yarn')
    const s = sid()
    runHook('path-strategy.mjs', edit(dir, 'src/stores/foo.js', s))
    runHook('strategy-map.mjs', { cwd: dir, session_id: s, prompt: 'a' })
    const depois = ctx(runHook('strategy-map.mjs', { cwd: dir, session_id: s, prompt: 'b' }))
    assert.doesNotMatch(depois, /Pendente desde a ultima edicao/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('respeita o kill switch', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('path-strategy.mjs', edit(dir, 'src/B.js', sid()), { AIDLC_STRATEGY: '0' })
    assert.equal(r.out.trim(), '')
    rmSync(dir, { recursive: true, force: true })
  })

  test('cabe no orcamento de latencia, e ele dispara a cada Edit', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('path-strategy.mjs', edit(dir, 'src/C.js', sid()))
    assert.ok(r.ms < BUDGET_MS, `${r.ms}ms acima do teto de ${BUDGET_MS}ms`)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('contexto de produto no strategy-map', () => {
  /*
   * O contexto de produto nao pode viver so num repo: quem entra em outro precisa saber o que
   * o projeto e e o que ja foi decidido. O nucleo viaja no mapa, o resto fica na skill
   * aidlc-context, sob demanda.
   */
  const ctx = (r) => {
    assert.equal(r.code, 0)
    return JSON.parse(r.out || '{}').hookSpecificOutput?.additionalContext ?? ''
  }

  test('o mapa completo carrega o nucleo e aponta a skill', () => {
    const dir = fixtureRepo('yarn')
    const c = ctx(runHook('strategy-map.mjs', { cwd: dir, session_id: sid(), prompt: 'oi' }))
    assert.match(c, /crit[ée]rio de aceite [ée] dado/)
    assert.match(c, /evid[êe]ncia colada no chat/, 'o fato que muda o comportamento no primeiro turno')
    assert.match(c, /aidlc-context/, 'sem o ponteiro, o resto do contexto nunca e aberto')
    rmSync(dir, { recursive: true, force: true })
  })

  test('a linha curta NAO paga o nucleo de novo', () => {
    const dir = fixtureRepo('yarn')
    const s = sid()
    runHook('strategy-map.mjs', { cwd: dir, session_id: s, prompt: 'a' })
    const curto = ctx(runHook('strategy-map.mjs', { cwd: dir, session_id: s, prompt: 'b' }))
    assert.doesNotMatch(curto, /crit[ée]rio de aceite [ée] dado/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('o nucleo cabe no orcamento em TODA tecnologia, nao so na do fixture', () => {
    /*
     * Ele e pago no primeiro prompt e a cada FULL_EVERY, entao o teto e o que impede a
     * tentacao de ir enchendo o kernel ate ele virar o CLAUDE.md de novo.
     *
     * O teto e medido por tecnologia porque a evidencia entra no mapa: a stack com mais
     * evidencia produz o maior payload, e testar so a do fixture deixaria o crescimento dela
     * passar sem ninguem medir.
     */
    const TETO = 1536
    const kernelBytes = readFileSync(join(HOOKS, '../context/kernel.md'), 'utf8').trim().replace(/\s+/g, ' ').length
    for (const f of readdirSync(join(HOOKS, '../quality')).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
      const m = JSON.parse(readFileSync(join(HOOKS, '../quality', f), 'utf8'))
      /* Reproduz o que o hook monta, sem precisar de um repo real por tecnologia. */
      const tamanho =
        kernelBytes +
        `[aidlc-harness] ${m.label}. Gate: aidlc-gate. Evidencia exigida no Stop: ${(m.evidence ?? []).map((e) => e.label).join('; ')}.`.length +
        `Leia antes de escrever: ${(m.strategy?.always ?? []).join(', ')}.`.length +
        `Revisor da stack: ${(m.gates ?? []).filter((g) => g.agent).map((g) => `${g.agent} (${g.model}, bloqueante)`).join(', ')}. Rode como subagente e cole o veredito.`.length +
        'Skills do kit: aidlc-context, blast, bolts, repo-standard.'.length
      assert.ok(tamanho < TETO, `${m.tech}: mapa completo estimado em ${tamanho} B, teto de ${TETO} B`)
    }
  })

  test('depois de um /compact o nucleo volta pelo SessionStart', () => {
    /*
     * O buraco que isto fecha: FULL_EVERY e 8 e o livro-caixa nao e zerado pela compactacao,
     * entao um /compact no prompt 9 deixava a sessao sem o nucleo ate o prompt 16. O
     * SessionStart e o unico evento que sabe que a compactacao acabou de acontecer.
     */
    const dir = fixtureRepo('yarn')
    const ler = (source) => {
      const r = runHook('session-brief.mjs', { cwd: dir, session_id: sid(), source })
      return JSON.parse(r.out || '{}').hookSpecificOutput?.additionalContext ?? ''
    }
    assert.doesNotMatch(ler('startup'), /crit[ée]rio de aceite [ée] dado/, 'no arranque o strategy-map ja entrega o nucleo')
    assert.match(ler('compact'), /crit[ée]rio de aceite [ée] dado/, 'depois do compact ele precisa voltar por aqui')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('revisor por stack, cobertura', () => {
  /*
   * Toda stack que PUBLICA tem revisor. A prova nao e ler os manifestos: e o hook devolvendo
   * o nome do revisor quando um caminho daquela stack e tocado, porque foi exatamente isso
   * que faltava quando tres dos quatro revisores nao existiam.
   */
  const ctx = (r) => JSON.parse(r.out || '{}').hookSpecificOutput?.additionalContext ?? ''
  const edit = (dir, rel) => ({ cwd: dir, session_id: sid(), tool_name: 'Edit', tool_input: { file_path: join(dir, rel) } })

  test('node-yarn devolve o supply-chain-reviewer ao tocar o package.json', () => {
    const dir = fixtureRepo('yarn')
    assert.match(ctx(runHook('path-strategy.mjs', edit(dir, 'package.json'))), /supply-chain-reviewer/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('node-npm devolve o supply-chain-reviewer ao tocar o lockfile', () => {
    const dir = fixtureRepo('npm')
    assert.match(ctx(runHook('path-strategy.mjs', edit(dir, 'package-lock.json'))), /supply-chain-reviewer/)
    rmSync(dir, { recursive: true, force: true })
  })

  test('todo gate de revisor aponta pra agente que existe, e e cobrado no Stop', () => {
    /* Gate de revisor apontando pro vazio afirma uma revisao que ninguem faz. */
    const quality = join(HOOKS, '../quality')
    const agentes = new Set(
      readdirSync(join(HOOKS, '../agents'))
        .filter((f) => f.endsWith('.md'))
        .map((f) => f.replace(/\.md$/, '')),
    )
    let revisores = 0
    for (const f of readdirSync(quality).filter((x) => x.endsWith('.json') && !x.startsWith('_'))) {
      const m = JSON.parse(readFileSync(join(quality, f), 'utf8'))
      /* Desde 2.13.0 a cobranca e por agente: a evidencia cujo marker casa o nome do subagente. */
      const cobra = (agent) => (m.evidence ?? []).some((e) => (e.markers ?? []).some((mk) => new RegExp(mk, 'i').test(agent)))
      for (const g of m.gates ?? []) {
        if (typeof g.agent !== 'string') continue
        revisores++
        assert.ok(agentes.has(g.agent), `${f}: gate "${g.id}" exige ${g.agent}, que nao existe em agents/`)
        assert.equal(g.blocking, true, `${f}: revisor que nao bloqueia e revisor sem dentes`)
        assert.ok(cobra(g.agent), `${f}: gate de revisor ${g.agent} sem evidencia que o cobre, o Stop libera sem o veredito`)
      }
    }
    assert.ok(revisores >= 2, `esperava ao menos 2 stacks com revisor, achei ${revisores}`)
  })
})

describe('ponteiro de leitura resolvido', () => {
  /*
   * Os repos podem ficar em niveis de pasta diferentes. Um
   * `../aidlc-harness/rules/x.md` fixo no manifesto acerta um layout e quebra o
   * outro em silencio. O manifesto declara `@kit/`, e quem resolve e o kit, que sabe onde
   * ele proprio esta.
   */
  test('o token @kit nunca chega cru no contexto do agente', () => {
    const dir = fixtureRepo('yarn')
    const r = runHook('path-strategy.mjs', {
      cwd: dir,
      session_id: sid(),
      tool_input: { file_path: join(dir, 'src/A.js') },
    })
    const c = JSON.parse(r.out || '{}').hookSpecificOutput?.additionalContext ?? ''
    assert.doesNotMatch(c, /@kit\//, 'ponteiro cru nao abre em lugar nenhum')
    rmSync(dir, { recursive: true, force: true })
  })

  test('resolve pra um caminho que existe de verdade, de dentro do kit e de um projeto vizinho', async () => {
    const { expandPointer, KIT_BASE } = await import('../lib/strategy.mjs')
    const alvo = '@kit/rules/testing.md'

    const dentro = expandPointer(alvo, KIT_BASE)
    assert.ok(existsSync(join(KIT_BASE, dentro)) || existsSync(dentro), `nao resolve de dentro do kit: ${dentro}`)

    const vizinho = join(KIT_BASE, '..', '..', '..', 'projeto-vizinho')
    const fora = expandPointer(alvo, vizinho)
    assert.ok(existsSync(fora) || existsSync(join(vizinho, fora)), `nao resolve de um projeto vizinho: ${fora}`)
  })
})

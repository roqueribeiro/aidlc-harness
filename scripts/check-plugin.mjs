#!/usr/bin/env node
/*
 * Valida o plugin ANTES de instalar, sem depender do CLI estar na maquina.
 *
 * Existe por causa de uma falha silenciosa que passou despercebida ate a vespera de
 * instalar: `description: Traz o repo ao padrao comum: README, ...` tem `: ` dentro de
 * um escalar YAML sem aspas. O parser desiste da frontmatter INTEIRA e o agente carrega
 * com metadata vazia. Nada quebra, nada avisa: o agente simplesmente nao tem mais nome,
 * modelo nem tools, e escolhe tudo por default. Dois dos quatro agentes e uma das quatro
 * skills estavam assim.
 *
 * `claude plugin validate --strict` pega isso, e e a autoridade. Este script existe porque
 * o CLI nem sempre esta instalado onde o gate roda, e porque um check que reprova em 40 ms
 * roda em toda sessao, enquanto um que depende de `npm install -g` roda quando alguem lembra.
 *
 * Uso: node scripts/check-plugin.mjs [--json]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const PLUGIN = join(ROOT, 'plugins/aidlc-harness')
const JSON_OUT = process.argv.includes('--json')

const problems = []
const fail = (file, msg) => problems.push({ file: file.replace(ROOT + '/', ''), msg })

/**
 * Le a frontmatter do jeito que um parser YAML leria, e reprova no que faria ele desistir.
 * Nao e um parser completo: e a lista do que ja quebrou ou quebraria calado.
 */
function checkFrontmatter(file, kind) {
  const src = readFileSync(file, 'utf8')
  const m = src.match(/^---\n([\s\S]*?)\n---/)
  if (!m) {
    fail(file, `${kind} sem frontmatter delimitada por ---`)
    return null
  }

  const fields = {}
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue

    if (line.includes('\t')) {
      fail(file, `frontmatter tem TAB, que YAML recusa como indentacao: ${line.trim().slice(0, 50)}`)
      continue
    }

    const km = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
    if (!km) {
      // Continuacao de lista ou de bloco: fora do escopo, mas nao pode ser lixo solto.
      if (!/^\s+(-|\S)/.test(line)) fail(file, `linha de frontmatter que nao e chave nem continuacao: ${line.trim().slice(0, 50)}`)
      continue
    }

    const [, key, rawValue] = km
    const value = rawValue.trim()
    fields[key] = value

    /*
     * Escalar citado que nao FECHA e a mesma falha silenciosa com outra roupa: o YAML engole
     * as linhas seguintes como continuacao, `tools` e `model` somem, e o agente carrega
     * escolhendo tudo por default. Acontece quando a descricao abre aspa simples e nao fecha.
     *
     * A primeira versao desta checagem exigia fechar na MESMA linha, e reprovava duas coisas
     * legitimas: comentario depois do valor (`model: "haiku"  # o mais barato`) e escalar
     * citado de varias linhas, que YAML aceita. Falso vermelho com mensagem factualmente
     * errada e pior que a checagem nao existir, entao ela olha o bloco inteiro: so reprova
     * quando a aspa nunca fecha ate o fim da frontmatter.
     */
    if (/^["']/.test(value)) {
      if (!fechaAspa(value, m[1], line)) {
        const q = value[0]
        fail(file, `\`${key}\` abre ${q === '"' ? 'aspa dupla' : 'aspa simples'} e nao fecha ate o fim da frontmatter: o YAML engole o resto e a frontmatter perde campo em silencio.`)
      }
      continue
    }
    if (!value || /^[[{|>]/.test(value)) continue // vazio, lista, bloco: ok

    /*
     * O erro que motivou o arquivo. `chave: texto com : no meio` faz o YAML ver duas
     * chaves aninhadas onde so ha prosa, e a frontmatter inteira e descartada.
     */
    if (/:\s/.test(value)) {
      fail(file, `\`${key}\` tem ": " sem aspas, a frontmatter inteira e descartada em silencio. Envolva em aspas simples.`)
    }
    if (/^\S*\s+#/.test(value)) {
      fail(file, `\`${key}\` tem " #" sem aspas, o YAML corta o resto como comentario.`)
    }
  }

  return fields
}


/**
 * A aspa aberta em `value` fecha em algum ponto da frontmatter?
 *
 * Procura a partir da propria linha e segue pelas seguintes, porque escalar citado de varias
 * linhas e YAML valido. Em aspa simples, `''` e a forma escapada e nao fecha nada.
 */
function fechaAspa(value, bloco, linhaAtual) {
  const q = value[0]
  const linhas = bloco.split('\n')
  const i = linhas.indexOf(linhaAtual)
  const resto = (i < 0 ? [linhaAtual] : linhas.slice(i)).join('\n')
  const corpo = resto.slice(resto.indexOf(q) + 1)
  if (q === '"') return /(^|[^\\])"/.test(corpo)
  // aspa simples: some com os pares escapados antes de procurar a que fecha
  return corpo.replace(/''/g, '').includes("'")
}

function checkAgents() {
  const dir = join(PLUGIN, 'agents')
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const file = join(dir, f)
    const fields = checkFrontmatter(file, 'agente')
    if (!fields) continue
    for (const req of ['name', 'description']) {
      if (!fields[req]) fail(file, `agente sem \`${req}\``)
    }
    const expected = f.replace(/\.md$/, '')
    const declared = (fields.name ?? '').replace(/^['"]|['"]$/g, '')
    if (declared && declared !== expected) fail(file, `name "${declared}" nao bate com o arquivo "${expected}"`)
    /* Agente de plugin nao aceita esses campos: o loader ignora, e o autor pensa que valeu. */
    for (const proibido of ['hooks', 'mcpServers', 'permissionMode']) {
      if (fields[proibido] !== undefined) fail(file, `agente de plugin nao suporta \`${proibido}\`, o loader ignora calado`)
    }
  }
}

function checkCommands() {
  const dir = join(PLUGIN, 'commands')
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const file = join(dir, f)
    const fields = checkFrontmatter(file, 'comando')
    if (!fields) continue
    // Sem `description` o comando aparece na lista sem dizer o que faz, e ninguem usa.
    if (!fields.description) fail(file, 'comando sem `description`')
    /*
     * Comando cita executavel no corpo. Se o nome mudar, o comando manda o agente
     * rodar algo que nao existe, e so se descobre com ele na mao.
     */
    const body = readFileSync(file, 'utf8')
    for (const m of body.matchAll(/^\s*(aidlc-[a-z]+)\b/gm)) {
      if (!existsSync(join(PLUGIN, 'tools', m[1]))) fail(file, `cita \`${m[1]}\`, que nao existe em tools/`)
    }
  }
}

function checkSkills() {
  const dir = join(PLUGIN, 'skills')
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const skillDir = join(dir, name)
    if (!statSync(skillDir).isDirectory()) continue
    const file = join(skillDir, 'SKILL.md')
    if (!existsSync(file)) {
      fail(skillDir, 'skill sem SKILL.md')
      continue
    }
    const fields = checkFrontmatter(file, 'skill')
    if (!fields) continue
    for (const req of ['name', 'description']) {
      if (!fields[req]) fail(file, `skill sem \`${req}\``)
    }
    const declared = (fields.name ?? '').replace(/^['"]|['"]$/g, '')
    if (declared && declared !== name) fail(file, `name "${declared}" nao bate com o diretorio "${name}"`)
  }
}

/*
 * Registro de hook e a checagem mais importante daqui, e a que faltava.
 *
 * Um hook nao registrado nao da erro: ele simplesmente nunca roda. O arquivo continua no repo,
 * roda a mao, passa no teste, aparece na documentacao, e o guard que ele deveria impor esta
 * desligado o tempo todo. Um guard que falha aberto e indistinguivel de um guard satisfeito.
 *
 * Duas formas de isso acontecer: a chave "Stop" solta no nivel de cima do hooks.json, irma de
 * "hooks" em vez de filha dela (o loader le so `cfg.hooks`), e um plugin com hooks/ sem hooks.json.
 *
 * Daí as tres regras abaixo: nada de chave desconhecida no topo, todo .mjs de hooks/ precisa
 * estar referenciado, e plugin com hooks/ precisa ter hooks.json.
 */
function checkHooks() {
  const dir = join(PLUGIN, 'hooks')
  if (!existsSync(dir)) return

  const noDisco = readdirSync(dir).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))
  const file = join(dir, 'hooks.json')
  if (!existsSync(file)) {
    if (noDisco.length) fail(dir, `${noDisco.length} hook(s) em hooks/ e nenhum hooks.json: o Claude Code registra ZERO deles`)
    return
  }

  const cfg = JSON.parse(readFileSync(file, 'utf8'))

  /* Chave irma de "hooks" e o erro que nao avisa: o loader le `cfg.hooks` e ignora o resto. */
  for (const key of Object.keys(cfg)) {
    if (!['hooks', '$comment', '$schema'].includes(key)) {
      fail(file, `chave "${key}" no nivel de cima, fora de "hooks": o loader ignora, e o hook nunca roda`)
    }
  }

  const referenciados = new Set()
  let count = 0
  for (const [event, matchers] of Object.entries(cfg.hooks ?? {})) {
    if (!Array.isArray(matchers)) continue
    for (const matcher of matchers) {
      for (const h of matcher.hooks ?? []) {
        count++
        const cmd = String(h.command ?? '')
        // O comando vem citado e com a variavel do plugin: resolve os dois antes de olhar o disco.
        const target = cmd
          .replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, PLUGIN)
          .replace(/^\s*node\s+/, '')
          .replace(/^["']|["'].*$/g, '')
          .trim()
        if (!target) fail(file, `${event}: hook sem command`)
        else if (!existsSync(target)) fail(file, `${event}: command aponta para ${target}, que nao existe`)
        else referenciados.add(basename(target))
      }
    }
  }
  if (!count) fail(file, 'hooks.json sem nenhum hook')

  for (const f of noDisco) {
    if (!referenciados.has(f)) fail(join(dir, f), 'hook existe em hooks/ e nao esta em hooks.json: nunca vai rodar')
  }
}

/*
 * Gate do tipo `agent` que aponta pra subagente inexistente.
 *
 * Por que existe: o `check-quality-manifests` valida so `typeof g.agent === 'string'`, e contar
 * agentes sem cruzar com os manifestos deixa os dois verdes afirmando uma cobertura que nao
 * existe. Trocar o nome por um inexistente precisa reprovar.
 *
 * Gate que aponta pro vazio e pior que gate nenhum: ele afirma revisao que ninguem faz.
 */
function checkManifestAgents() {
  const agentsDir = join(PLUGIN, 'agents')
  const qualityDir = join(PLUGIN, 'quality')
  if (!existsSync(agentsDir) || !existsSync(qualityDir)) return

  const existem = new Set(
    readdirSync(agentsDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, '')),
  )

  for (const f of readdirSync(qualityDir).filter((x) => x.endsWith('.json') && x !== '_schema.json' && x !== '_org.json')) {
    const file = join(qualityDir, f)
    let m
    try {
      m = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      continue // check-quality-manifests.mjs e quem reprova JSON quebrado
    }

    const declarados = new Set()
    for (const g of m.gates ?? []) {
      if (typeof g.agent !== 'string') continue
      declarados.add(g.agent)
      if (!existem.has(g.agent)) {
        fail(file, `gate "${g.id}" exige o subagente \`${g.agent}\`, que nao existe em agents/${g.blocking ? ' (e o gate se declara BLOQUEANTE)' : ''}`)
      }
    }

    /*
     * Declaracao e cobranca precisam concordar.
     *
     * A evidencia `stack-review` faz o Stop recusar o encerramento sem o veredito. Um gate
     * que se declara `blocking: false` e ao mesmo tempo e cobrado no Stop diz duas coisas
     * diferentes sobre a mesma revisao, e quem le o manifesto acredita na errada.
     */
    /*
     * Desde 2.13.0 um manifesto pode ter mais de um revisor (o de stack e o de cadeia de
     * suprimento), entao a cobranca e por AGENTE: a evidencia que cobra um gate de agente e
     * a que tem um marker casando o nome do subagente, seja ela `stack-review` ou outra.
     */
    const cobraAgente = (agent) => (m.evidence ?? []).find((e) => (e.markers ?? []).some((mk) => {
      try {
        return new RegExp(mk, 'i').test(agent)
      } catch {
        return false
      }
    }))
    for (const g of m.gates ?? []) {
      if (typeof g.agent !== 'string') continue
      const cobra = cobraAgente(g.agent)
      if (cobra && !g.blocking) {
        fail(file, `gate "${g.id}" se declara \`blocking: false\` mas a evidencia ${cobra.id} o cobra no Stop: ou ele bloqueia, ou a evidencia sai`)
      }
      if (!cobra && g.blocking) {
        fail(file, `gate "${g.id}" e bloqueante e nada o cobra: sem uma evidencia cujo marker case \`${g.agent}\` o Stop libera com a revisao nunca feita`)
      }
    }

    /* O reviewer do bloco strategy e o mesmo contrato visto do outro lado. */
    for (const p of m.strategy?.paths ?? []) {
      if (!p.reviewer) continue
      if (!existem.has(p.reviewer)) {
        fail(file, `strategy aponta o revisor \`${p.reviewer}\` para ${(p.when ?? []).join(', ')}, e ele nao existe em agents/`)
      } else if (!declarados.has(p.reviewer)) {
        fail(file, `strategy pede \`${p.reviewer}\`, mas nenhum gate do manifesto o declara: o Stop nunca vai cobrar o veredito`)
      }
    }
  }
}

function checkVersions() {
  const pluginJson = join(PLUGIN, '.claude-plugin/plugin.json')
  const marketJson = join(ROOT, '.claude-plugin/marketplace.json')
  if (!existsSync(pluginJson) || !existsSync(marketJson)) return
  const p = JSON.parse(readFileSync(pluginJson, 'utf8'))
  const mk = JSON.parse(readFileSync(marketJson, 'utf8'))
  const entry = (mk.plugins ?? []).find((x) => x.name === p.name)
  if (!entry) {
    fail(marketJson, `marketplace nao lista o plugin "${p.name}"`)
    return
  }
  /*
   * A versao que vale e a do plugin.json. O `metadata.version` do marketplace e do CATALOGO,
   * outra coisa. So checamos divergencia se alguem tiver escrito uma versao na entrada do
   * plugin, porque ai sim ela mente: a instalacao "atualiza" para um numero que nao
   * corresponde ao disco, e o proximo install decide que ja esta em dia.
   */
  if (entry.version !== undefined && entry.version !== p.version) {
    fail(marketJson, `entrada do plugin diz ${entry.version}, plugin.json diz ${p.version}`)
  }
  const src = join(ROOT, '.claude-plugin', entry.source ?? '')
  const resolved = entry.source?.startsWith('./') ? join(ROOT, entry.source.slice(2)) : src
  if (!entry.source || !existsSync(resolved)) {
    fail(marketJson, `source "${entry.source}" nao resolve para um diretorio deste repo`)
  }
}

function checkBins() {
  const dir = join(PLUGIN, 'tools')
  if (!existsSync(dir)) return
  for (const f of readdirSync(dir)) {
    const file = join(dir, f)
    const mode = statSync(file).mode
    // Sem bit de execucao, o bin entra no PATH e o shell responde "Permission denied".
    if (!(mode & 0o111)) fail(file, 'executavel sem bit de execucao, o PATH do plugin nao vai conseguir rodar')
    const first = readFileSync(file, 'utf8').split('\n', 1)[0]
    if (!first.startsWith('#!')) fail(file, 'executavel sem shebang')
  }
}

/*
 * Comando de barra com sintaxe de shell dentro e uma instrucao que nao funciona em lugar
 * nenhum, e pior: parece de shell, entao convida a colar no terminal, onde o zsh responde
 * `no such file or directory: /plugin`. E o erro tipico de quem cola o comando no terminal.
 * Dentro da sessao, `$(pwd)` chega literal e tambem falha. Escreva o caminho absoluto, ou
 * use `claude plugin marketplace add` no shell, onde a expansao acontece de verdade.
 */
function checkDocs() {
  for (const rel of ['README.md', 'docs/PRIMEIRA-SESSAO.md', 'CLAUDE.md']) {
    const file = join(ROOT, rel)
    if (!existsSync(file)) continue
    const src = readFileSync(file, 'utf8')
    src.split('\n').forEach((line, i) => {
      if (/^\s*\/[a-z-]+.*\$\(/.test(line)) {
        fail(file, `linha ${i + 1}: comando de barra com \`$(...)\`, que a sessao nao expande e o shell nao entende`)
      }
    })
  }
}

/*
 * Regra do kit vale para o kit.
 *
 * Um plugin que afirma o que nao e verdade em lugares que nenhum check olha ensina o que nao
 * pratica: um template que manda usar um comando que nao existe, um comando que diz "n de 8"
 * com dez segredos no cofre, um `userConfig` que nada le, prosa com o estilo que o proprio kit
 * recusa. Cada um e pequeno; juntos, minam a confianca no resto.
 */
function checkSelf() {
  const kitFiles = (dir, ext = '.md') => {
    const abs = join(PLUGIN, dir)
    if (!existsSync(abs)) return []
    const out = []
    for (const f of readdirSync(abs, { withFileTypes: true })) {
      if (f.isDirectory()) out.push(...kitFiles(join(dir, f.name), ext))
      else if (f.name.endsWith(ext)) out.push(join(abs, f.name))
    }
    return out
  }

  // 1. Comando de barra citado em template, comando ou skill do kit precisa existir: como
  //    skill ou comando do proprio kit, ou comando nativo do Claude Code.
  const skillsDoKit = new Set([
    ...(existsSync(join(PLUGIN, 'skills')) ? readdirSync(join(PLUGIN, 'skills')) : []),
    ...(existsSync(join(PLUGIN, 'commands')) ? readdirSync(join(PLUGIN, 'commands')).map((f) => f.replace(/\.md$/, '')) : []),
    ...(existsSync(join(PLUGIN, 'workflows')) ? readdirSync(join(PLUGIN, 'workflows')).filter((f) => f.endsWith('.js')).map((f) => f.replace(/\.js$/, '')) : []),
  ])
  const CONHECIDOS = new Set(['reload-plugins', 'plugin', 'context', 'compact', 'clear', 'help', 'model', 'status', 'init', 'memory', 'loop', 'agents', 'hooks', 'config', 'permissions', 'resume', 'rewind', 'mcp'])
  for (const file of [...kitFiles('templates'), ...kitFiles('commands'), ...kitFiles('skills')]) {
    const src = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, ' ')
    for (const m of src.matchAll(/`\/([a-z][a-z0-9-]+)`/g)) {
      const nome = m[1]
      if (CONHECIDOS.has(nome) || skillsDoKit.has(nome)) continue
      if (nome.includes('/')) continue
      fail(file, `cita \`/${nome}\`, que nao e skill nem comando do kit (nem comando nativo conhecido)`)
    }
  }

  // 2. O denominador do cofre nao se escreve a mao.
  const secretsBin = join(PLUGIN, 'tools', 'aidlc-secrets')
  if (existsSync(secretsBin)) {
    const src = readFileSync(secretsBin, 'utf8')
    const total = (src.match(/^\s{2}'[a-z0-9-]+':\s*\{/gm) ?? []).length
    for (const file of [...kitFiles('commands'), ...kitFiles('skills'), ...kitFiles('templates')]) {
      const prosa = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, ' ')
      for (const m of prosa.matchAll(/\bn de (\d+)\b/g)) {
        if (Number(m[1]) !== total) fail(file, `diz "n de ${m[1]}" e o cofre declara ${total} segredos: numero escrito a mao envelheceu`)
      }
    }
  }

  // 3. Todo userConfig do plugin.json precisa ser lido por algum hook, lib ou executavel.
  const manifest = join(PLUGIN, '.claude-plugin', 'plugin.json')
  if (existsSync(manifest)) {
    const cfg = JSON.parse(readFileSync(manifest, 'utf8')).userConfig ?? {}
    const codigo = [...kitFiles('hooks', '.mjs'), ...kitFiles('lib', '.mjs'), ...kitFiles('tools', '')]
      .map((f) => {
        try {
          return readFileSync(f, 'utf8')
        } catch {
          return ''
        }
      })
      .join('\n')
    for (const key of Object.keys(cfg)) {
      const env = `CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`
      if (!codigo.includes(env)) fail(manifest, `userConfig "${key}" aparece na tela do plugin e nenhum hook, lib ou executavel le ${env}`)
    }
  }

  // 4. A prosa do kit obedece ao ai-tells: travessao fora de code fence e de backtick.
  for (const file of [...kitFiles('agents'), ...kitFiles('commands'), ...kitFiles('skills'), ...kitFiles('templates'), ...kitFiles('context')]) {
    const src = readFileSync(file, 'utf8')
    let fence = false
    src.split('\n').forEach((line, i) => {
      if (line.trim().startsWith('```')) {
        fence = !fence
        return
      }
      if (fence) return
      const semSpan = line.replace(/`[^`]*`/g, '')
      if (/[—–]/.test(semSpan)) fail(file, `linha ${i + 1}: travessao na prosa do kit (convencao de estilo: use virgula, ponto ou parenteses)`)
    })
  }
}

checkAgents()
checkManifestAgents()
checkSelf()
checkSkills()
checkCommands()
checkDocs()
checkHooks()
checkVersions()
checkBins()

if (problems.length) {
  if (JSON_OUT) console.log(JSON.stringify({ ok: false, problems }))
  else {
    console.error('plugin com problema:\n')
    for (const p of problems) console.error(`  ${p.file}\n    ${p.msg}`)
    console.error('\nO CLI e a autoridade final:\n  claude plugin validate ./plugins/aidlc-harness --strict')
  }
  process.exit(1)
}

const counts = {
  agents: existsSync(join(PLUGIN, 'agents')) ? readdirSync(join(PLUGIN, 'agents')).filter((f) => f.endsWith('.md')).length : 0,
  skills: existsSync(join(PLUGIN, 'skills')) ? readdirSync(join(PLUGIN, 'skills')).length : 0,
  commands: existsSync(join(PLUGIN, 'commands')) ? readdirSync(join(PLUGIN, 'commands')).filter((f) => f.endsWith('.md')).length : 0,
  hooks: existsSync(join(PLUGIN, 'hooks')) ? readdirSync(join(PLUGIN, 'hooks')).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).length : 0,
  bins: existsSync(join(PLUGIN, 'tools')) ? readdirSync(join(PLUGIN, 'tools')).length : 0,
}
if (JSON_OUT) console.log(JSON.stringify({ ok: true, ...counts }))
else
  console.log(
    `ok, plugin valido: ${counts.agents} agentes, ${counts.skills} skills, ${counts.commands} comandos, ${counts.hooks} hooks, ${counts.bins} executaveis.`,
  )

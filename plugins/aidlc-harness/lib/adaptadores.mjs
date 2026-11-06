/*
 * Adaptadores: o que cada ferramenta de IA recebe para rodar o ciclo do jeito nativo dela.
 *
 * O método mora em um lugar só, as skills `aidlc-inception` e `aidlc-construction` do kit. O
 * aidlc-init copia as duas para `.agents/skills/` do projeto (o caminho que a maioria das
 * ferramentas lê) e gera, para cada ferramenta escolhida, o comando no formato e na pasta dela.
 * Cada comando aponta o arquivo da skill e nomeia a ferramenta de pergunta daquela ferramenta.
 *
 * Por que isso é mecanismo e não instrução: até a v0.1 só o Claude Code tinha /inception, e as
 * outras ferramentas improvisavam a partir do AGENTS.md (no OpenCode, uma lista numerada que a
 * pessoa respondia digitando). Agora o comando de cada uma é gerado e conferido pelo
 * `aidlc-init --check`, e um teste reprova adaptador de ferramenta com janela de pergunta que
 * não a nomeie.
 *
 * Os nomes das ferramentas de pergunta e os caminhos foram conferidos na documentação oficial
 * de cada ferramenta em 06/11/2026. Ferramenta muda rápido: `verificado` diz o que foi exercido
 * de verdade, com print, e o que só foi lido na documentação.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
export const FASES_COMANDO = ['inception', 'construction']
const NOME_FASE = { inception: 'Inception', construction: 'Construction' }
const SKILL = (fase) => `.agents/skills/aidlc-${fase}/SKILL.md`

/** O texto da skill do kit, tal como vai para o projeto. */
export const textoDaSkill = (fase) => readFileSync(join(KIT, 'skills', `aidlc-${fase}`, 'SKILL.md'), 'utf8').replace(/\r\n/g, '\n')

/*
 * Cada ferramenta:
 *   nome        como a ferramenta se chama
 *   pergunta    a instrução de pergunta; null quando a ferramenta não tem janela de pergunta
 *   ferramentaDePergunta  o nome exato da ferramenta de pergunta (o teste confere que o comando o cita)
 *   args        como o texto digitado depois do comando chega ao arquivo
 *   comandos    caminho do arquivo do comando de cada fase, e o formato
 *   invocar     o que a pessoa digita
 *   extras      arquivos a mais (instrução que a ferramenta não lê sozinha)
 */
export const ADAPTADORES = {
  claude: {
    nome: 'Claude Code',
    ferramentaDePergunta: 'AskUserQuestion',
    invocar: { inception: '/inception', construction: '/construction' },
    plugin: true,
  },
  opencode: {
    nome: 'OpenCode',
    ferramentaDePergunta: 'question',
    pergunta: 'a ferramenta `question` (várias perguntas numa chamada, `multiple: true` para múltipla escolha; ela já oferece o campo de texto livre). Rode no agente principal: em subagente ela vem negada',
    args: '$ARGUMENTS',
    comandos: (f) => ({ destino: `.opencode/commands/aidlc-${f}.md`, formato: 'md', frente: { description: descricao(f), agent: 'build' } }),
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction' },
  },
  kilo: {
    nome: 'Kilo Code',
    ferramentaDePergunta: 'question',
    pergunta: 'a ferramenta `question` (`multiple: true` para múltipla escolha; ela já oferece o campo de texto livre)',
    args: 'o texto que veio junto com o comando',
    comandos: (f) => ({ destino: `.kilo/commands/aidlc-${f}.md`, formato: 'md', frente: { description: descricao(f) } }),
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction' },
  },
  copilot: {
    nome: 'GitHub Copilot',
    hooks: {
      destino: '.github/hooks/aidlc.json',
      json: { version: 1, hooks: { preToolUse: [{ type: 'command', command: 'aidlc-hook shell --formato copilot', timeoutSec: 15 }], agentStop: [{ type: 'command', command: 'aidlc-hook parada --formato copilot', timeoutSec: 120 }] } },
    },
    ferramentaDePergunta: 'askQuestions',
    pergunta: 'a ferramenta de perguntas do VS Code, #tool:vscode/askQuestions (escolha única ou múltipla, texto livre, recomendada destacada); no Copilot CLI, a ferramenta `ask_user`',
    args: '${input:pedido:o que se quer construir, em uma frase}',
    comandos: (f) => ({ destino: `.github/prompts/aidlc-${f}.prompt.md`, formato: 'md', frente: { description: descricao(f), agent: 'agent' } }),
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction', nota: { pt: 'no VS Code; no Copilot CLI, peça a skill aidlc-inception', en: 'in VS Code; in the Copilot CLI, ask for the aidlc-inception skill' } },
    extras: () => [],
  },
  cursor: {
    nome: 'Cursor',
    hooks: {
      destino: '.cursor/hooks.json',
      json: { version: 1, hooks: { beforeShellExecution: [{ command: 'aidlc-hook shell --formato cursor' }], stop: [{ command: 'aidlc-hook parada --formato cursor', loop_limit: 3 }] } },
    },
    ferramentaDePergunta: 'Ask questions',
    pergunta: 'a ferramenta "Ask questions" do Cursor (o cartão de perguntas com opções e campo "Other")',
    args: 'o texto que veio junto com o comando',
    comandos: (f) => ({ destino: `.cursor/commands/aidlc-${f}.md`, formato: 'md' }),
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction' },
  },
  gemini: {
    nome: 'Gemini CLI',
    ferramentaDePergunta: 'ask_user',
    pergunta: 'a ferramenta `ask_user` (até 4 perguntas, tipo `choice` com `multiSelect` quando couber, ou `text`)',
    args: '{{args}}',
    comandos: (f) => ({ destino: `.gemini/commands/aidlc/${f}.toml`, formato: 'toml', frente: { description: descricao(f) } }),
    invocar: { inception: '/aidlc:inception', construction: '/aidlc:construction' },
    // O Gemini CLI lê GEMINI.md, não AGENTS.md, a menos que o settings mande; o import é o caminho sem mexer no settings.
    extras: () => [{ destino: 'GEMINI.md', conteudo: '@AGENTS.md\n', derivado: true }],
  },
  antigravity: {
    nome: 'Google Antigravity',
    ferramentaDePergunta: null,
    pergunta: 'o seletor de respostas do Antigravity (opções clicáveis e "Write-in")',
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction', nota: { pt: 'a skill vira comando', en: 'the skill becomes a command' } },
    soSkill: true,
  },
  kiro: {
    nome: 'Kiro',
    ferramentaDePergunta: null,
    pergunta: null,
    args: 'o texto que veio junto com o comando',
    comandos: (f) => ({ destino: `.kiro/steering/aidlc-${f}.md`, formato: 'md', frente: { inclusion: 'manual' } }),
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction', nota: { pt: 'ou #aidlc-inception no chat', en: 'or #aidlc-inception in the chat' } },
    skillsEm: '.kiro/skills',
  },
  codex: {
    nome: 'OpenAI Codex',
    hooks: {
      destino: '.codex/hooks.json',
      json: {
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'aidlc-hook shell --formato codex', timeout: 15 }] }],
          Stop: [{ hooks: [{ type: 'command', command: 'aidlc-hook parada --formato codex', timeout: 120 }] }],
        },
      },
    },
    ferramentaDePergunta: 'request_user_input',
    pergunta: 'a ferramenta `request_user_input` (até 3 perguntas por chamada, recomendada primeiro). Ela só existe no modo Plan: entre com /plan antes',
    invocar: { inception: '$aidlc-inception', construction: '$aidlc-construction', nota: { pt: 'depois de entrar no modo Plan com /plan', en: 'after entering Plan mode with /plan' } },
    soSkill: true,
  },
  devin: {
    nome: 'Devin Desktop (ex-Windsurf)',
    ferramentaDePergunta: 'ask_user_question',
    pergunta: 'a ferramenta `ask_user_question` (opções clicáveis e "Other")',
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction', nota: { pt: 'a skill vira comando', en: 'the skill becomes a command' } },
    soSkill: true,
  },
  cline: {
    nome: 'Cline',
    ferramentaDePergunta: 'ask_question',
    pergunta: 'a ferramenta `ask_question` (uma pergunta por chamada, 2 a 5 opções clicáveis); faça as perguntas em sequência, a recomendada primeiro',
    args: 'o texto que veio junto com o comando',
    comandos: (f) => ({ destino: `.clinerules/workflows/aidlc-${f}.md`, formato: 'md' }),
    invocar: { inception: '/aidlc-inception.md', construction: '/aidlc-construction.md' },
  },
  junie: {
    nome: 'JetBrains Junie',
    ferramentaDePergunta: 'AskUserQuestion',
    pergunta: 'a ferramenta `AskUserQuestion` do Junie (escolha entre opções)',
    args: '$prompt',
    comandos: (f) => ({ destino: `.junie/commands/aidlc-${f}.md`, formato: 'md', frente: { description: descricao(f), allowPromptArgument: true } }),
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction' },
  },
  continue: {
    nome: 'Continue',
    ferramentaDePergunta: 'AskQuestion',
    pergunta: 'a ferramenta `AskQuestion` (no CLI `cn`; na extensão, use o formato em texto da seção 5 da skill)',
    args: 'o texto que veio junto com o comando',
    comandos: (f) => ({ destino: `.continue/prompts/aidlc-${f}.md`, formato: 'md', frente: { name: `aidlc-${f}`, description: descricao(f), invokable: true } }),
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction' },
  },
  augment: {
    nome: 'Augment (Auggie)',
    ferramentaDePergunta: null,
    pergunta: null,
    args: '$ARGUMENTS',
    comandos: (f) => ({ destino: `.augment/commands/aidlc-${f}.md`, formato: 'md', frente: { description: descricao(f) } }),
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction' },
  },
  zed: {
    nome: 'Zed',
    ferramentaDePergunta: null,
    pergunta: null,
    invocar: { inception: '/aidlc-inception', construction: '/aidlc-construction', nota: { pt: 'a skill vira comando', en: 'the skill becomes a command' } },
    soSkill: true,
  },
}

export const FERRAMENTAS = Object.keys(ADAPTADORES)
export const FERRAMENTAS_PADRAO = ['claude', 'kiro', 'copilot']
export const APELIDOS = { windsurf: 'devin', 'github-copilot': 'copilot', vscode: 'copilot', 'kilo-code': 'kilo', 'kilocode': 'kilo', antigravity: 'antigravity', amazonq: 'kiro', 'amazon-q': 'kiro' }

function descricao(f) {
  return f === 'inception'
    ? 'AI-DLC Inception: a IA rascunha requisitos, histórias e unidades com as recomendações dela e pergunta só o que a equipe precisa decidir'
    : 'AI-DLC Construction: desenho e plano de testes recomendados e aprovados antes do código, depois uma unidade por vez'
}

/** Normaliza a lista pedida em --tools: apelidos, "todas", duplicados e desconhecidas. */
export function resolverFerramentas(lista) {
  const out = []
  for (const bruto of lista) {
    const t = APELIDOS[bruto.toLowerCase()] ?? bruto.toLowerCase()
    if (t === 'all' || t === 'todas') return [...FERRAMENTAS]
    if (!ADAPTADORES[t]) throw new Error(`ferramenta desconhecida: ${bruto} (use ${FERRAMENTAS.join(', ')} ou all)`)
    if (!out.includes(t)) out.push(t)
  }
  return out
}

function frenteYaml(frente) {
  if (!frente) return ''
  const linhas = Object.entries(frente).map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v}`)
  return `---\n${linhas.join('\n')}\n---\n\n`
}

/** O corpo do comando de uma fase para uma ferramenta. Uma fonte para todas. */
export function corpoDoComando(fase, id) {
  const a = ADAPTADORES[id]
  const pedido = fase === 'inception' ? 'Pedido inicial' : 'Unidade alvo'
  const padrao = fase === 'inception' ? 'se vazio, leia os insumos e o repositório e proponha você mesmo um ponto de partida' : 'se vazio, a primeira de `aidlc/inception/units-of-work.md` sem entrega'
  const comoPerguntar = a.pergunta
    ? `- Pergunte **sempre** com ${a.pergunta}. Recomendada primeiro, com "(Recomendado)" no rótulo. Nunca escreva perguntas numeradas no texto para a pessoa responder digitando.`
    : `- Esta ferramenta não tem janela de perguntas: use o formato em texto da seção 5 da skill \`aidlc-inception\` (opções com letras, a recomendada marcada, e "ok" aceita todas as recomendações).`
  const fechar =
    fase === 'inception'
      ? '- Você não aprova: `Aprovado por:`, `Data:` e `Premissas revisadas por:` ficam em branco, e `aidlc-phase check inception` com a saída crua fecha o turno.'
      : '- A porta de entrada é `aidlc-phase check inception`: se sair com erro, pare e mostre a saída. Você não aprova: `Aprovado por:` e `Data:` ficam em branco.'
  return [
    `Conduza a **${NOME_FASE[fase]}** deste projeto seguindo a skill \`aidlc-${fase}\`: leia o arquivo \`${SKILL(fase)}\` inteiro antes de qualquer outra coisa. Ele é a fonte do método; este comando só fixa o que vale no ${a.nome}.`,
    '',
    `${pedido}: ${a.args ?? 'o texto que veio junto com o comando'} (${padrao}).`,
    '',
    `No ${a.nome}:`,
    '',
    comoPerguntar,
    '- O rascunho completo vem **antes** da primeira pergunta, e são no máximo 5 perguntas na rodada.',
    fechar,
    '',
    '<!-- Gerado pelo aidlc-init. Não edite: o aidlc-init --check reprova divergência e o --sync regrava. -->',
    '',
  ].join('\n')
}

function arquivoDoComando(fase, id) {
  const a = ADAPTADORES[id]
  const c = a.comandos(fase)
  const corpo = corpoDoComando(fase, id)
  if (c.formato === 'toml') {
    const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"')
    return { destino: c.destino, conteudo: `description = "${c.frente.description.replace(/"/g, '\\"')}"\nprompt = """\n${esc(corpo)}"""\n`, derivado: true }
  }
  return { destino: c.destino, conteudo: frenteYaml(c.frente) + corpo, derivado: true }
}

/** Tudo o que as ferramentas escolhidas recebem além do AGENTS.md e das cópias de instrução. */
export function planoDosAdaptadores(ferramentas) {
  const plano = []
  const foraDoClaude = ferramentas.filter((f) => !ADAPTADORES[f].plugin)
  if (foraDoClaude.length) {
    for (const fase of FASES_COMANDO) plano.push({ destino: SKILL(fase), conteudo: textoDaSkill(fase), derivado: true })
  }
  for (const id of foraDoClaude) {
    const a = ADAPTADORES[id]
    if (a.skillsEm) for (const fase of FASES_COMANDO) plano.push({ destino: `${a.skillsEm}/aidlc-${fase}/SKILL.md`, conteudo: textoDaSkill(fase), derivado: true })
    if (a.comandos) for (const fase of FASES_COMANDO) plano.push(arquivoDoComando(fase, id))
    if (a.extras) plano.push(...a.extras())
    if (a.hooks) plano.push({ destino: a.hooks.destino, json: a.hooks.json, conteudo: JSON.stringify(a.hooks.json, null, 2) + '\n', mesclarJson: true })
  }
  if (ferramentas.length) plano.push({ destino: '.aidlc/COMANDOS.md', conteudo: guiaDeComandos(ferramentas), derivado: true })
  return plano
}

/** `.aidlc/COMANDOS.md`: o que digitar em cada ferramenta escolhida. */
export function guiaDeComandos(ferramentas) {
  const linhas = ferramentas.map((id) => {
    const a = ADAPTADORES[id]
    const janela = a.ferramentaDePergunta ? `\`${a.ferramentaDePergunta}\`` : a.pergunta ? 'seletor nativo' : 'em texto, com letras'
    const nota = a.invocar.nota ? ` (${a.invocar.nota.pt})` : ''
    return `| ${a.nome} | \`${a.invocar.inception}\`${nota} | \`${a.invocar.construction}\` | ${janela} |`
  })
  return [
    '# Comandos do AI-DLC neste projeto',
    '',
    'Gerado pelo `aidlc-init` para as ferramentas escolhidas. Para incluir outra: `aidlc-init --tools <lista>`.',
    '',
    '| Ferramenta | Inception | Construction | Perguntas |',
    '| --- | --- | --- | --- |',
    ...linhas,
    '',
    'Em todas: a IA escreve o rascunho completo antes de perguntar e faz no máximo 5 perguntas. O método está em `.agents/skills/aidlc-inception/SKILL.md`.',
    '',
  ].join('\n')
}

/*
 * Arquivo de hooks que o time pode já ter (.cursor/hooks.json, .codex/hooks.json): o kit não o
 * substitui, acrescenta as entradas dele. Uma entrada do kit é reconhecida pelo comando
 * `aidlc-hook`, em qualquer profundidade (o formato do Codex aninha `hooks` dentro do evento).
 */
const comandosDe = (x) => (Array.isArray(x) ? x.flatMap(comandosDe) : x && typeof x === 'object' ? [...(typeof x.command === 'string' ? [x.command] : []), ...Object.values(x).flatMap(comandosDe)] : [])

export function mesclarHooks(existente, nosso) {
  const out = structuredClone(existente ?? {})
  for (const [k, v] of Object.entries(nosso)) if (k !== 'hooks' && !(k in out)) out[k] = v
  out.hooks ??= {}
  for (const [evento, entradas] of Object.entries(nosso.hooks)) {
    const atuais = Array.isArray(out.hooks[evento]) ? out.hooks[evento] : []
    const tem = new Set(comandosDe(atuais))
    out.hooks[evento] = [...atuais, ...entradas.filter((e) => !comandosDe(e).every((c) => tem.has(c)))]
  }
  return out
}

/** As entradas do kit estão todas no arquivo? */
export function hooksPresentes(existente, nosso) {
  const tem = new Set(comandosDe(existente?.hooks ?? {}))
  return comandosDe(nosso.hooks).every((c) => tem.has(c))
}

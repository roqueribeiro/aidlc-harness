#!/usr/bin/env node
/*
 * gerar-ferramentas: uma página por ferramenta de IA, em inglês e em português, a partir dos
 * adaptadores do kit (plugins/aidlc-harness/lib/adaptadores.mjs).
 *
 *   node scripts/gerar-ferramentas.mjs           # regrava docs/tools/, docs/pt-BR/ferramentas/ e a tabela dos READMEs
 *   node scripts/gerar-ferramentas.mjs --check   # exit 1 se algum arquivo divergir do que o código gera
 *
 * Por que gerado: o que cada ferramenta recebe (arquivo, comando, ferramenta de pergunta, hook) é
 * dado do adaptador. Página escrita à mão diria uma coisa e o aidlc-init faria outra, e a
 * divergência só apareceria na frente de quem estivesse seguindo o passo a passo. Aqui os caminhos
 * de arquivo saem do mesmo plano que o aidlc-init aplica; o texto de cada ferramenta (limites,
 * observações, fonte) mora em NOTAS, e o teste reprova adaptador sem nota.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ehPrincipal } from './lib/principal.mjs'
import { ADAPTADORES, FERRAMENTAS, planoDosAdaptadores } from '../plugins/aidlc-harness/lib/adaptadores.mjs'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const INSTALAR = 'npx github:roqueribeiro/aidlc-harness init'
export const VERIFICADO_EM = '2026-11-06'

/*
 * O que não é dado de adaptador: onde a ferramenta documenta isso, como abrir, e os limites.
 * `verificado` só vira algo diferente de null com print da ferramenta de verdade (docs/compatibilidade/).
 */
export const NOTAS = {
  claude: {
    fonte: 'https://code.claude.com/docs/en/plugins',
    abrir: { en: 'Install the plugin once: `claude plugin marketplace add roqueribeiro/aidlc-harness` and `claude plugin install aidlc-harness@aidlc`. Then open Claude Code in the project.', pt: 'Instale o plugin uma vez: `claude plugin marketplace add roqueribeiro/aidlc-harness` e `claude plugin install aidlc-harness@aidlc`. Depois abra o Claude Code no projeto.' },
    limites: { en: ['The full kit: blocking hooks (evidence at Stop, secret, package manager), agents, skills and commands.', '`AskUserQuestion` takes up to 4 questions per call; with 5 the agent makes two calls.'], pt: ['O kit inteiro: hooks que bloqueiam (evidência no Stop, segredo, gerenciador de pacote), agentes, skills e comandos.', 'O `AskUserQuestion` aceita até 4 perguntas por chamada; com 5, o agente faz duas chamadas.'] },
  },
  opencode: {
    fonte: 'https://opencode.ai/docs/commands/',
    abrir: { en: 'Open `opencode` in the project. It reads `AGENTS.md` by itself.', pt: 'Abra o `opencode` no projeto. Ele lê o `AGENTS.md` sozinho.' },
    limites: { en: ['The command runs in the main `build` agent: in a subagent the `question` tool is denied.', 'No hook can hold the end of a turn in OpenCode: evidence is enforced by CI.'], pt: ['O comando roda no agente principal `build`: em subagente a ferramenta `question` vem negada.', 'Nenhum hook do OpenCode segura o fim do turno: a evidência é cobrada pelo CI.'] },
  },
  kilo: {
    fonte: 'https://kilo.ai/docs',
    abrir: { en: 'Open the project in the Kilo Code extension or CLI. It reads `AGENTS.md`.', pt: 'Abra o projeto na extensão ou no CLI do Kilo Code. Ele lê o `AGENTS.md`.' },
    limites: { en: ['No hook can hold the end of a turn: evidence is enforced by CI.'], pt: ['Nenhum hook segura o fim do turno: a evidência é cobrada pelo CI.'] },
  },
  copilot: {
    fonte: 'https://code.visualstudio.com/docs/agent-customization/prompt-files',
    abrir: { en: 'In VS Code, open the project with Copilot Chat in **Agent** mode. In the Copilot CLI, run `copilot` in the project.', pt: 'No VS Code, abra o projeto com o Copilot Chat no modo **Agent**. No Copilot CLI, rode `copilot` no projeto.' },
    limites: { en: ['Prompt files (`/aidlc-inception`) are a VS Code feature; in the CLI ask for the `aidlc-inception` skill.', 'The hooks need `aidlc-hook` on the `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).', 'The cloud coding agent has no question window: it asks in the pull request.'], pt: ['Prompt files (`/aidlc-inception`) são do VS Code; no CLI, peça a skill `aidlc-inception`.', 'Os hooks precisam do `aidlc-hook` no `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).', 'O agente de nuvem não tem janela de perguntas: ele pergunta no pull request.'] },
  },
  cursor: {
    fonte: 'https://cursor.com/docs/agent/hooks',
    abrir: { en: 'Open the project in Cursor, in Agent mode. It reads `AGENTS.md` by itself.', pt: 'Abra o projeto no Cursor, no modo Agent. Ele lê o `AGENTS.md` sozinho.' },
    limites: { en: ['There is no way to declare the "Ask questions" tool in a command: the command asks for it in words.', 'The hooks need `aidlc-hook` on the `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).'], pt: ['Não há como declarar a ferramenta "Ask questions" num comando: o comando pede por escrito.', 'Os hooks precisam do `aidlc-hook` no `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).'] },
  },
  gemini: {
    fonte: 'https://geminicli.com/docs/cli/custom-commands/',
    abrir: { en: 'Run `gemini` in the project. `GEMINI.md` imports `AGENTS.md`.', pt: 'Rode `gemini` no projeto. O `GEMINI.md` importa o `AGENTS.md`.' },
    limites: { en: ['Since June 2026 Gemini CLI serves only Code Assist Standard/Enterprise licenses and paid API keys; personal accounts moved to Antigravity.', 'The kit does not generate Gemini CLI hooks yet: evidence is enforced by CI.'], pt: ['Desde junho de 2026 o Gemini CLI atende só licenças Code Assist Standard/Enterprise e chaves de API pagas; contas pessoais foram para o Antigravity.', 'O kit ainda não gera hooks do Gemini CLI: a evidência é cobrada pelo CI.'] },
  },
  antigravity: {
    fonte: 'https://antigravity.google/docs/skills/',
    abrir: { en: 'Open the project in Antigravity. It reads `AGENTS.md` and the skills in `.agents/skills/`.', pt: 'Abra o projeto no Antigravity. Ele lê o `AGENTS.md` e as skills de `.agents/skills/`.' },
    limites: { en: ['The name of the question tool is not in the public documentation; the skill asks for the answer picker.', 'The kit does not generate Antigravity hooks yet: evidence is enforced by CI.'], pt: ['O nome da ferramenta de pergunta não está na documentação pública; a skill pede o seletor de respostas.', 'O kit ainda não gera hooks do Antigravity: a evidência é cobrada pelo CI.'] },
  },
  kiro: {
    fonte: 'https://kiro.dev/docs/steering/',
    abrir: { en: 'Open the project in Kiro (IDE or CLI).', pt: 'Abra o projeto no Kiro (IDE ou CLI).' },
    limites: { en: ['Kiro has no question window: the Inception asks in short text with lettered options, the recommended one marked, and "ok" accepts them all. This is the same format as Kiro\'s own Plan mode.', 'Kiro also reads `AGENTS.md`, so the rules may enter twice with `.kiro/steering/aidlc.md`; run the canary test and keep one.', 'The kit does not generate Kiro hooks yet: evidence is enforced by CI.'], pt: ['O Kiro não tem janela de perguntas: a Inception pergunta em texto curto, com opções em letras, a recomendada marcada, e "ok" aceita todas. É o mesmo formato do modo Plan do próprio Kiro.', 'O Kiro também lê o `AGENTS.md`, então as regras podem entrar duas vezes com o `.kiro/steering/aidlc.md`; rode o teste do canário e fique com um.', 'O kit ainda não gera hooks do Kiro: a evidência é cobrada pelo CI.'] },
  },
  codex: {
    fonte: 'https://learn.chatgpt.com/docs/hooks',
    abrir: { en: 'Run `codex` in the project, then `/hooks` to review and trust the kit hooks (Codex skips project hooks until you trust them).', pt: 'Rode `codex` no projeto e depois `/hooks` para revisar e confiar nos hooks do kit (o Codex ignora hooks de projeto até você confiar).' },
    limites: { en: ['`request_user_input` exists only in Plan mode: enter `/plan` before the Inception.', 'The hooks need `aidlc-hook` on the `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).'], pt: ['O `request_user_input` só existe no modo Plan: entre com `/plan` antes da Inception.', 'Os hooks precisam do `aidlc-hook` no `PATH` (`npm install -g github:roqueribeiro/aidlc-harness`).'] },
  },
  devin: {
    fonte: 'https://docs.devin.ai/desktop/devin-local/customizations.md',
    abrir: { en: 'Open the project in Devin Desktop (formerly Windsurf). It reads `AGENTS.md` and `.agents/skills/`.', pt: 'Abra o projeto no Devin Desktop (antigo Windsurf). Ele lê o `AGENTS.md` e `.agents/skills/`.' },
    limites: { en: ['Devin can also load the Claude Code plugin itself (`devin plugins install roqueribeiro/aidlc-harness`), which brings the hooks; that path was not exercised.'], pt: ['O Devin também carrega o próprio plugin do Claude Code (`devin plugins install roqueribeiro/aidlc-harness`), o que traz os hooks; esse caminho não foi exercido.'] },
  },
  cline: {
    fonte: 'https://docs.cline.bot/customization/cline-rules.md',
    abrir: { en: 'Open the project in VS Code with Cline. It reads `AGENTS.md`.', pt: 'Abra o projeto no VS Code com o Cline. Ele lê o `AGENTS.md`.' },
    limites: { en: ['`ask_question` takes one question per call, single choice: the questions come one after another.', 'The kit does not generate Cline hooks yet: evidence is enforced by CI.'], pt: ['O `ask_question` faz uma pergunta por chamada, de escolha única: as perguntas vêm uma depois da outra.', 'O kit ainda não gera hooks do Cline: a evidência é cobrada pelo CI.'] },
  },
  junie: {
    fonte: 'https://junie.jetbrains.com/docs/custom-slash-commands.html',
    abrir: { en: 'Open the project in a JetBrains IDE with Junie, or run the Junie CLI. It reads `AGENTS.md`.', pt: 'Abra o projeto numa IDE JetBrains com o Junie, ou rode o Junie CLI. Ele lê o `AGENTS.md`.' },
    limites: { en: ['Junie ignores project hooks by default (they live in `~/.junie/config.json`): evidence is enforced by CI.'], pt: ['O Junie ignora hooks de projeto por padrão (eles moram em `~/.junie/config.json`): a evidência é cobrada pelo CI.'] },
  },
  continue: {
    fonte: 'https://docs.continue.dev/customize/deep-dives/prompts',
    abrir: { en: 'Open the project with the Continue extension or the `cn` CLI. It reads `AGENTS.md`.', pt: 'Abra o projeto com a extensão do Continue ou o CLI `cn`. Ele lê o `AGENTS.md`.' },
    limites: { en: ['`AskQuestion` exists in the `cn` CLI; in the extension the Inception asks in text.'], pt: ['O `AskQuestion` existe no CLI `cn`; na extensão a Inception pergunta em texto.'] },
  },
  augment: {
    fonte: 'https://docs.augmentcode.com/cli/custom-commands',
    abrir: { en: 'Run `auggie` in the project. It reads `AGENTS.md`.', pt: 'Rode `auggie` no projeto. Ele lê o `AGENTS.md`.' },
    limites: { en: ['No question window was found in Augment\'s documentation: the Inception asks in text.', 'Augment hooks can block a tool but not the end of a turn.'], pt: ['Não achamos janela de perguntas na documentação do Augment: a Inception pergunta em texto.', 'Os hooks do Augment bloqueiam ferramenta, mas não o fim do turno.'] },
  },
  zed: {
    fonte: 'https://zed.dev/docs/ai/skills',
    abrir: { en: 'Open the project in Zed. It reads `AGENTS.md` and the skills in `.agents/skills/`.', pt: 'Abra o projeto no Zed. Ele lê o `AGENTS.md` e as skills de `.agents/skills/`.' },
    limites: { en: ['Zed has no question window and no hooks: the Inception asks in text and CI enforces the evidence.'], pt: ['O Zed não tem janela de perguntas nem hooks: a Inception pergunta em texto e o CI cobra a evidência.'] },
  },
}

const T = {
  en: {
    dir: 'docs/tools',
    indice: 'docs/TOOLS.md',
    ref: (id) => `tools/${id}.md`,
    titulo: (n) => `${n} with aidlc-harness`,
    gerado: '> **Generated** from the kit adapters by `node scripts/gerar-ferramentas.mjs`; CI checks it with `--check`. Do not edit by hand.',
    par: (id) => `*Also available in [Brazilian Portuguese](../pt-BR/ferramentas/${id}.md).*`,
    resumo: 'At a glance',
    linhas: ['Command', 'Question window', 'Kit hooks', 'Verified on a real machine'],
    sim: 'yes', nao: 'no, CI enforces the evidence', semJanela: 'none: text with lettered options',
    naoVerificado: `not yet (documentation checked on ${VERIFICADO_EM})`,
    passos: 'Step by step',
    p1: 'Prepare the project (in its folder, with Node 20.19 or newer):',
    p2: 'What the tool receives:',
    p4: 'Check that the rules arrive (canary test): add the line `Canary: this project\'s control word is "marmelada-42".` to `AGENTS.md` outside the kit block, open a **new** session and ask for the control word. If it answers `marmelada-42`, the rules arrive. Remove the line.',
    p5: (inv) => `Run the Inception: put whatever already exists about the request in \`aidlc/inception/insumos/\` and type \`${inv}\` with one sentence about what you want.`,
    p6janela: (nome) => `What you should see: a complete draft in \`aidlc/inception/\` first, then at most five questions ${nome}, the recommended option first. Accepting all recommendations is a valid answer.`,
    p6texto: 'What you should see: a complete draft in `aidlc/inception/` first, then one short message with at most five questions, lettered options and the recommended one marked; "ok" accepts them all.',
    p7: 'Close the phase: a person reviews and signs `Aprovado por:`, `Data:` and, when there are assumptions, `Premissas revisadas por:`. Then `aidlc-phase check inception` must exit 0. Construction comes next with the Construction command.',
    limites: 'Limits',
    fonte: 'Source',
    fonteTxt: (u) => `What this page says about the tool was checked against its official documentation on ${VERIFICADO_EM}: <${u}>. Tools change fast; if something differs in your version, open an issue.`,
    indTitulo: 'AI tools',
    indLead: 'The kit runs in 15 AI tools. Each one receives the Inception and Construction commands in its own format, naming its own question window; where the tool allows, the kit hooks also hold an unproven "done". Pick yours:',
    cab: '| Tool | Command | Question window | Kit hooks | Page |',
    pagina: 'step by step',
  },
  pt: {
    dir: 'docs/pt-BR/ferramentas',
    indice: 'docs/pt-BR/FERRAMENTAS.md',
    ref: (id) => `ferramentas/${id}.md`,
    titulo: (n) => `${n} com o aidlc-harness`,
    gerado: '> **Gerado** a partir dos adaptadores do kit por `node scripts/gerar-ferramentas.mjs`; o CI confere com `--check`. Não edite à mão.',
    par: (id) => `*Também em [inglês](../../tools/${id}.md).*`,
    resumo: 'Em resumo',
    linhas: ['Comando', 'Janela de perguntas', 'Hooks do kit', 'Verificado em máquina de verdade'],
    sim: 'sim', nao: 'não, o CI cobra a evidência', semJanela: 'não tem: texto com opções em letras',
    naoVerificado: `ainda não (documentação conferida em ${VERIFICADO_EM})`,
    passos: 'Passo a passo',
    p1: 'Prepare o projeto (na pasta dele, com Node 20.19 ou mais novo):',
    p2: 'O que a ferramenta recebe:',
    p4: 'Confira que as regras chegam (teste do canário): acrescente a linha `Canário: a palavra de controle deste projeto é "marmelada-42".` ao `AGENTS.md`, fora do bloco do kit, abra uma sessão **nova** e pergunte a palavra de controle. Se responder `marmelada-42`, as regras chegam. Tire a linha.',
    p5: (inv) => `Rode a Inception: ponha em \`aidlc/inception/insumos/\` o que já existe sobre o pedido e digite \`${inv}\` com uma frase do que você quer.`,
    p6janela: (nome) => `O que você deve ver: primeiro um rascunho completo em \`aidlc/inception/\`, depois no máximo cinco perguntas ${nome}, com a opção recomendada primeiro. Aceitar todas as recomendações é uma resposta válida.`,
    p6texto: 'O que você deve ver: primeiro um rascunho completo em `aidlc/inception/`, depois uma mensagem curta com no máximo cinco perguntas, opções em letras e a recomendada marcada; "ok" aceita todas.',
    p7: 'Feche a fase: uma pessoa revisa e assina `Aprovado por:`, `Data:` e, quando houver premissas, `Premissas revisadas por:`. Depois `aidlc-phase check inception` tem de sair com 0. A Construction vem em seguida, pelo comando de Construction.',
    limites: 'Limites',
    fonte: 'Fonte',
    fonteTxt: (u) => `O que esta página diz sobre a ferramenta foi conferido na documentação oficial dela em ${VERIFICADO_EM}: <${u}>. Ferramenta muda rápido; se algo for diferente na sua versão, abra uma issue.`,
    indTitulo: 'Ferramentas de IA',
    indLead: 'O kit roda em 15 ferramentas de IA. Cada uma recebe os comandos de Inception e Construction no formato dela, nomeando a própria janela de perguntas; onde a ferramenta deixa, os hooks do kit também seguram um "pronto" sem prova. Escolha a sua:',
    cab: '| Ferramenta | Comando | Janela de perguntas | Hooks do kit | Página |',
    pagina: 'passo a passo',
  },
}

function janela(a, l) {
  if (a.ferramentaDePergunta) return `\`${a.ferramentaDePergunta}\``
  if (a.pergunta) return l === 'en' ? 'answer picker' : 'seletor de respostas'
  return T[l].semJanela
}
const temHook = (a) => Boolean(a.plugin || a.hooks)

export function pagina(id, l) {
  const a = ADAPTADORES[id]
  const n = NOTAS[id]
  const t = T[l]
  const arquivos = id === 'claude' ? ['AGENTS.md', 'CLAUDE.md', ...planoDosAdaptadores([id]).map((p) => p.destino)] : ['AGENTS.md', ...planoDosAdaptadores([id]).map((p) => p.destino)]
  const nomeJanela = a.ferramentaDePergunta ? `in the \`${a.ferramentaDePergunta}\` window` : 'in the answer picker'
  const nomeJanelaPt = a.ferramentaDePergunta ? `na janela do \`${a.ferramentaDePergunta}\`` : 'no seletor de respostas'
  const passo6 = a.pergunta || a.plugin ? t.p6janela(l === 'en' ? nomeJanela : nomeJanelaPt) : t.p6texto
  return [
    `# ${t.titulo(a.nome)}`,
    '',
    t.par(id),
    '',
    t.gerado,
    '',
    `## ${t.resumo}`,
    '',
    `| | |`,
    '| --- | --- |',
    `| ${t.linhas[0]} | \`${a.invocar.inception}\`${a.invocar.nota ? ` (${a.invocar.nota[l]})` : ''} |`,
    `| ${t.linhas[1]} | ${janela(a, l)} |`,
    `| ${t.linhas[2]} | ${temHook(a) ? t.sim : t.nao} |`,
    `| ${t.linhas[3]} | ${t.naoVerificado} |`,
    '',
    `## ${t.passos}`,
    '',
    `1. ${t.p1}`,
    '',
    '    ```bash',
    `    ${INSTALAR} --tools ${id}`,
    '    ```',
    '',
    `2. ${t.p2}`,
    '',
    ...arquivos.map((f) => `    - \`${f}\``),
    '',
    `3. ${n.abrir[l]}`,
    `4. ${t.p4}`,
    `5. ${t.p5(a.invocar.inception)}${a.invocar.nota ? ` (${a.invocar.nota[l]})` : ''}`,
    `6. ${passo6}`,
    `7. ${t.p7}`,
    '',
    `## ${t.limites}`,
    '',
    ...n.limites[l].map((x) => `- ${x}`),
    '',
    `## ${t.fonte}`,
    '',
    t.fonteTxt(n.fonte),
    '',
  ].join('\n')
}

export function tabela(l, prefixo = '') {
  const t = T[l]
  return [
    t.cab,
    '| --- | --- | --- | --- | --- |',
    ...FERRAMENTAS.map((id) => {
      const a = ADAPTADORES[id]
      return `| ${a.nome} | \`${a.invocar.inception}\`${a.invocar.nota ? ` (${a.invocar.nota[l]})` : ''} | ${janela(a, l)} | ${temHook(a) ? t.sim : t.nao.split(',')[0]} | [${t.pagina}](${prefixo}${t.ref(id)}) |`
    }),
  ].join('\n')
}

export function indice(l) {
  const t = T[l]
  return [`# ${t.indTitulo}`, '', l === 'en' ? '*Also available in [Brazilian Portuguese](pt-BR/FERRAMENTAS.md).*' : '*Também em [inglês](../TOOLS.md).*', '', t.gerado, '', t.indLead, '', tabela(l), ''].join('\n')
}

/** Todos os arquivos que este script gera, com o conteúdo. */
export function gerar(lerReadme = (p) => readFileSync(join(RAIZ, p), 'utf8')) {
  const out = []
  for (const l of ['en', 'pt']) {
    for (const id of FERRAMENTAS) out.push({ arquivo: `${T[l].dir}/${id}.md`, conteudo: pagina(id, l) })
    out.push({ arquivo: T[l].indice, conteudo: indice(l) })
  }
  // A tabela dos READMEs fica entre marcadores e sai do mesmo dado.
  for (const [readme, l, prefixo] of [['README.md', 'en', 'docs/'], ['README.pt-BR.md', 'pt', 'docs/pt-BR/']]) {
    const txt = lerReadme(readme)
    const rx = /<!-- ferramentas:inicio -->\n[\s\S]*?<!-- ferramentas:fim -->/
    if (!rx.test(txt)) continue
    out.push({ arquivo: readme, conteudo: txt.replace(rx, `<!-- ferramentas:inicio -->\n${tabela(l, prefixo)}\n<!-- ferramentas:fim -->`) })
  }
  return out
}

if (ehPrincipal(import.meta.url)) {
  const check = process.argv.includes('--check')
  const divergentes = []
  for (const { arquivo, conteudo } of gerar()) {
    const p = join(RAIZ, arquivo)
    const atual = existsSync(p) ? readFileSync(p, 'utf8') : null
    if (atual === conteudo) continue
    if (check) divergentes.push(arquivo)
    else {
      mkdirSync(dirname(p), { recursive: true })
      writeFileSync(p, conteudo)
      console.log(`regravado ${arquivo}`)
    }
  }
  if (check) {
    if (divergentes.length) {
      console.log(`paginas de ferramenta desatualizadas (rode node scripts/gerar-ferramentas.mjs):\n${divergentes.map((d) => `  ${d}`).join('\n')}`)
      process.exit(1)
    }
    console.log(`ok, ${FERRAMENTAS.length} ferramentas documentadas em ingles e portugues, e a tabela dos READMEs acompanha os adaptadores`)
  }
}

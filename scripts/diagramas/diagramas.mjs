/*
 * Os diagramas da documentacao, como codigo. Cada funcao recebe um `Desenho` (ja com o tema) e
 * desenha nele. A lista `DIAGRAMAS` e o que `gerar-diagramas.mjs` produz, em claro e escuro.
 *
 * Os numeros que aparecem aqui (quantos hooks, executaveis) NAO sao escritos a mao: vem de
 * `inventario`, lido do disco. Assim um diagrama nao diz 8 hooks quando o kit tem 9.
 */
import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { largura } from './lib.mjs'

export function inventario(raiz) {
  const kit = join(raiz, 'plugins/aidlc-harness')
  const lista = (dir, filtro = () => true) => (existsSync(join(kit, dir)) ? readdirSync(join(kit, dir)).filter(filtro).sort() : [])
  return {
    hooks: lista('hooks', (f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map((f) => f.replace(/\.mjs$/, '')),
    tools: lista('tools'),
    skills: lista('skills', (d) => existsSync(join(kit, 'skills', d, 'SKILL.md'))),
    agentes: lista('agents', (f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')),
    comandos: lista('commands', (f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, '')),
    tecnologias: lista('quality', (f) => f.endsWith('.json') && !f.startsWith('_')).map((f) => f.replace(/\.json$/, '')),
  }
}

/** Distribui chips em linhas dentro de [x, x+w). Devolve o y logo abaixo da ultima linha. */
function fluxo(d, x, y, w, nomes, tipo = 'neutro') {
  let cx = x
  let cy = y
  for (const n of nomes) {
    const cw = Math.ceil(largura(n, 11, true)) + 18
    if (cx + cw > x + w) {
      cx = x
      cy += 28
    }
    d.chip(cx, cy, n, { tipo })
    cx += cw + 8
  }
  return cy + 28
}

// 1 ------------------------------------------------------------------------------------------
function contexto(d, inv) {
  d.titulo('Contexto: onde o aidlc-harness entra', 'Pessoas decidem, a ferramenta de IA executa, o kit cobra o que foi combinado.')
  const pessoas = d.caixa(40, 110, 240, 120, 'Equipe', ['define o que construir', 'assina a aprovação de', 'cada fase no artefato'], { tipo: 'roxo' })

  d.faixa(330, 100, 360, 290, 'Ferramentas de IA (a sua escolha)')
  const cc = d.caixa(350, 135, 320, 68, 'Claude Code', ['hooks bloqueantes e plugin'], { tipo: 'destaque' })
  const kiro = d.caixa(350, 214, 320, 68, 'Kiro', ['lê .kiro/steering/aidlc.md'])
  const cop = d.caixa(350, 293, 320, 68, 'GitHub Copilot', ['lê .github/copilot-instructions.md'])

  d.faixa(740, 100, 420, 290, 'Repositório do projeto')
  d.caixa(760, 135, 180, 68, 'AGENTS.md', ['fonte única das regras'])
  d.caixa(960, 135, 180, 68, 'aidlc/', ['requisitos, unidades'])
  d.caixa(760, 214, 180, 68, '.aidlc/', ['manifestos e grafo'])
  d.caixa(960, 214, 180, 68, 'CI', ['aidlc-gate.yml, DCO'])
  d.caixa(760, 293, 380, 68, 'Código do projeto', ['testes, build, o que o gate roda'])

  d.faixa(330, 430, 830, 250, `aidlc-harness (${inv.hooks.length} hooks, ${inv.tools.length} executáveis, ${inv.tecnologias.length} manifestos)`, { cor: 'destaqueFundo', borda: 'destaque' })
  d.caixa(350, 470, 190, 90, 'Hooks', ['guards e lembretes', 'bloqueiam no tooling'], { tipo: 'destaque' })
  d.caixa(560, 470, 190, 90, 'Executáveis aidlc-*', ['gate, fases, scan,', 'doctor, secrets'], { tipo: 'destaque' })
  d.caixa(770, 470, 190, 90, 'Manifestos', ['quality/*.json', 'critério de aceite'], { tipo: 'destaque' })
  d.caixa(980, 470, 160, 90, 'Skills e agentes', ['contexto, revisão'], { tipo: 'destaque' })
  d.caixa(350, 580, 790, 80, 'Modelos', ['AGENTS.md, aidlc/, workflow de CI, loop de manutenção, gate de segurança'], { tipo: 'destaque' })

  d.faixa(40, 410, 250, 270, 'Plataformas de segurança')
  d.caixa(55, 440, 220, 68, 'RoqueShield', ['DAST, SAST, OSINT, IA'], { tipo: 'verde' })
  d.caixa(55, 518, 220, 68, 'Qualquer SARIF', ['Semgrep, CodeQL, Snyk'], { tipo: 'verde' })
  d.caixa(55, 596, 220, 68, 'Trivy (embutido)', ['aidlc-secscan, offline'], { tipo: 'verde' })

  d.seta([[280, 170], [330, 170]])
  d.seta([[690, 245], [740, 245]], { dupla: true })
  d.seta([[510, 430], [510, 392]], { rotulo: 'cobram', cor: 'destaque' })
  d.seta([[950, 430], [950, 392]], { rotulo: 'manifestos e gate', cor: 'destaque' })
  d.seta([[290, 550], [330, 550]], { cor: 'verde' })
  void pessoas; void cc; void kiro; void cop
}

// 2 ------------------------------------------------------------------------------------------
function containers(d, inv) {
  d.titulo('Containers: o que há dentro do plugin', 'Cada pasta tem uma função; tudo que decide algo é código testado, não instrução em prosa.')
  d.faixa(40, 90, 1120, 620, 'plugins/aidlc-harness', { cor: 'caixa' })

  d.faixa(60, 125, 540, 150, `hooks/ (${inv.hooks.length}): processos que o Claude Code dispara`, { cor: 'destaqueFundo', borda: 'destaque' })
  fluxo(d, 76, 160, 508, inv.hooks, 'destaque')

  d.faixa(620, 125, 520, 150, `tools/ (${inv.tools.length}): executáveis, sem custo de token`, { cor: 'destaqueFundo', borda: 'destaque' })
  fluxo(d, 636, 160, 488, inv.tools, 'destaque')

  d.faixa(60, 295, 540, 130, 'quality/: critério de aceite como dado', { cor: 'verdeFundo', borda: 'verde' })
  fluxo(d, 76, 330, 508, [...inv.tecnologias, '_org', '_schema'], 'verde')

  d.faixa(620, 295, 520, 130, 'lib/: lógica compartilhada e testada', { cor: 'ambarFundo', borda: 'ambar' })
  fluxo(d, 636, 330, 488, ['detect', 'strategy', 'phase', 'init', 'identity', 'scan', 'lockcheck', 'limpeza', 'scrub', 'graph'], 'ambar')

  d.faixa(60, 445, 540, 130, 'skills/, agents/, commands/', { cor: 'roxoFundo', borda: 'roxo' })
  fluxo(d, 76, 480, 508, [...inv.skills, ...inv.agentes, ...inv.comandos.map((c) => '/' + c)], 'roxo')

  d.faixa(620, 445, 520, 130, 'templates/, rules/, context/, graph/')
  fluxo(d, 636, 480, 488, ['project', 'aberto', 'loop', 'security', 'rules/testing', 'rules/secrets', 'rules/dependencies', 'kernel.md'])

  d.caixa(60, 595, 1080, 94, 'Fora do plugin, na raiz do repositório', ['scripts/: setup, install-git-hooks, definir-dono, gerar-prompts, gerar-diagramas e os check-*', 'docs/: esta documentação. Os testes moram ao lado do código que testam (*.test.mjs).'], { mono: false })
}

// 3 ------------------------------------------------------------------------------------------
function hooks(d) {
  d.titulo('Ciclo de vida dos hooks', 'Cinco eventos do Claude Code; cada um tem um dono, e quase tudo roda em menos de 70 ms.')
  const cols = [
    ['SessionStart', 'ao abrir ou retomar', [['session-brief', ['anuncia stack, gates', 'e fase em curso']]]],
    ['UserPromptSubmit', 'a cada prompt', [['strategy-map', ['reinjeta o mapa de regras', 'sobrevive ao /compact']]]],
    ['PreToolUse', 'antes de Bash/Write/Edit', [['scratch-guard', ['rascunho só na pasta', 'de scratch (opt-in)']], ['pkg-manager', ['yarn ou npm conforme', 'o manifesto do repo']], ['secret-guard', ['barra echo/cat de', 'segredo e dump de env']]]],
    ['PostToolUse', 'depois de Edit/Write', [['path-strategy', ['entrega a regra do', 'arquivo que mudou']]]],
    ['Stop', 'quando o agente quer parar', [['dod-check', ['exige a evidência do', 'manifesto no chat']], ['promise-check', ['barra "faço depois"', 'sem ter feito']]]],
  ]
  cols.forEach(([ev, quando, itens], i) => {
    const x = 40 + i * 226
    d.caixa(x, 100, 210, 78, ev, [quando], { tipo: i === 2 ? 'vermelho' : i === 4 ? 'ambar' : 'destaque' })
    itens.forEach(([nome, linhas], j) => d.caixa(x, 200 + j * 100, 210, 86, nome, linhas, { mono: false }))
    if (i < cols.length - 1) d.seta([[x + 210, 139], [x + 226, 139]])
  })
  d.faixa(40, 520, 1120, 150, 'Resultado de cada hook', { tracejado: true })
  d.caixa(60, 555, 340, 90, 'exit 2: bloqueia', ['PreToolUse impede o comando', 'e diz o que usar no lugar'], { tipo: 'vermelho' })
  d.caixa(420, 555, 340, 90, 'contexto adicional', ['SessionStart, UserPromptSubmit', 'e PostToolUse entregam texto'], { tipo: 'destaque' })
  d.caixa(780, 555, 360, 90, 'recusa o fim do turno', ['Stop pede a evidência; depois de', '3 recusas vira aviso e libera'], { tipo: 'ambar' })
}

// 4 ------------------------------------------------------------------------------------------
function fases(d) {
  d.titulo('As fases do AI-DLC e onde a aprovação humana fica', 'Interpretação do kit sobre o AI-DLC da AWS. Os artefatos moram no repositório, não numa ferramenta.')
  d.faixa(40, 100, 340, 330, 'Inception', { cor: 'destaqueFundo', borda: 'destaque' })
  d.texto(60, 150, 'A IA pergunta, a equipe responde', { cor: 'texto', negrito: true, tam: 13 })
  d.caixa(60, 170, 300, 70, 'aidlc/inception/', ['requirements.md'], { mono: true })
  d.caixa(60, 250, 300, 70, 'aidlc/inception/', ['units-of-work.md'], { mono: true })
  d.caixa(60, 330, 300, 84, '/inception', ['conduz a elaboração com a', 'equipe, sem inventar resposta'], { tipo: 'destaque' })

  d.faixa(430, 100, 340, 330, 'Construction', { cor: 'verdeFundo', borda: 'verde' })
  d.texto(450, 150, 'Bolts curtos, uma unidade por vez', { cor: 'texto', negrito: true, tam: 13 })
  d.caixa(450, 170, 300, 70, 'aidlc/construction/', ['design.md'], { mono: true })
  d.caixa(450, 250, 300, 70, 'Teste, implementação, gate', ['aidlc-gate com evidência crua'], { tipo: 'verde' })
  d.caixa(450, 330, 300, 84, '/construction', ['uma unidade por bolt;', 'gate verde antes de fechar'], { tipo: 'verde' })

  d.faixa(820, 100, 340, 330, 'Operations', { cor: 'ambarFundo', borda: 'ambar' })
  d.texto(840, 150, 'A parte mais fina do kit', { cor: 'texto', negrito: true, tam: 13 })
  d.caixa(840, 170, 300, 70, 'Entrega e observação', ['fica com o seu processo'], { tipo: 'ambar' })
  d.caixa(840, 250, 300, 70, 'aidlc-cycle', ['mede horas entre as fases'], { tipo: 'ambar' })
  d.caixa(840, 330, 300, 80, 'aidlc-limpeza', ['fecha a unidade sem sobras'], { tipo: 'ambar' })

  d.seta([[380, 265], [430, 265]], { cor: 'roxo' })
  d.seta([[770, 265], [820, 265]], { cor: 'roxo' })
  d.chip(386, 232, 'aprova', { tipo: 'roxo', mono: false })
  d.chip(776, 232, 'aprova', { tipo: 'roxo', mono: false })

  d.faixa(40, 460, 1120, 190, 'aidlc-phase: a trava entre as fases', { tracejado: true })
  d.caixa(60, 495, 340, 135, 'aidlc-phase check <fase>', ['reprova enquanto houver campo', 'por preencher ou aprovação em', 'branco no artefato'], { tipo: 'vermelho' })
  d.caixa(420, 495, 340, 135, 'A pessoa assina no arquivo', ['Aprovado por: e Data: no fim do', 'artefato; o check recusa nome', 'de IA, então só pessoa aprova'], { tipo: 'roxo' })
  d.caixa(780, 495, 360, 135, 'aidlc-phase status', ['mostra em que fase o projeto', 'está e o que impede a próxima', '(read-only)'], { tipo: 'neutro' })
}

// 5 ------------------------------------------------------------------------------------------
function camadas(d) {
  d.titulo('Camadas de manifesto: de onde vem o critério de aceite', 'Uma tecnologia é um arquivo JSON. O do projeto vence o do kit; a camada da organização vale para toda stack.')
  d.caixa(40, 110, 330, 100, 'Kit', ['plugins/aidlc-harness/quality/', 'node-yarn, node-npm, python-uv'], { mono: false, tipo: 'verde' })
  d.caixa(40, 240, 330, 100, 'Camada da organização', ['quality/_org.json', 'gate lockfile, evidência de limpeza'], { tipo: 'ambar' })
  d.caixa(40, 370, 330, 100, 'Projeto', ['.aidlc/quality/<tech>.json', 'o mesmo tech sobrescreve o do kit'], { tipo: 'destaque' })

  d.caixa(450, 200, 300, 150, 'Manifesto efetivo', ['gates: o que roda', 'evidence: o que colar no chat', 'strategy: qual regra, qual revisor', 'pkgManager, autonomy, security'], { tipo: 'roxo' })
  d.seta([[370, 160], [410, 160], [410, 275], [450, 275]], { cor: 'verde' })
  d.seta([[370, 290], [450, 290]], { cor: 'ambar', rotulo: 'herda' })
  d.seta([[370, 420], [410, 420], [410, 310], [450, 310]], { cor: 'destaque', rotulo: 'sobrescreve' })

  d.caixa(450, 400, 300, 90, 'Detecção', ['allFiles, anyFiles, packageDeps', 'olha o conteúdo, não o nome'], { tipo: 'neutro' })
  d.seta([[600, 400], [600, 350]], { rotulo: 'escolhe o tech' })

  d.caixa(850, 110, 310, 80, 'aidlc-gate', ['roda os gates e imprime o estado'], { tipo: 'neutro' })
  d.caixa(850, 210, 310, 80, 'session-brief', ['anuncia o que vale neste repo'], { tipo: 'neutro' })
  d.caixa(850, 310, 310, 80, 'dod-check', ['cobra a evidência no Stop'], { tipo: 'neutro' })
  d.caixa(850, 410, 310, 80, 'path-strategy', ['entrega a regra do arquivo'], { tipo: 'neutro' })
  for (const y of [150, 250, 350, 450]) d.seta([[750, 275], [800, 275], [800, y], [850, y]])

  d.caixa(40, 530, 1120, 110, 'Regras que o check-quality-manifests faz valer', ['inválido é ignorado e reportado, nunca silencioso; cópia literal de gate herdado reprova', 'gate tem exatamente um entre cmd e agent; ponteiro @kit/ para arquivo inexistente reprova', 'inherits: false recusa a herança; status archived tira a tecnologia de circulação'], { tipo: 'neutro' })
}

// 6 ------------------------------------------------------------------------------------------
function varredura(d) {
  d.titulo('Contrato de varredura: qualquer plataforma de segurança', 'O kit não embute um scanner. Ele cobra o resultado de um, e separa "limpo" de "não rodou".')
  d.faixa(40, 100, 300, 360, 'Plataformas (relatório JSON)')
  d.caixa(55, 135, 270, 90, 'RoqueShield', ['AI Fix Bundle', 'scan.scanners_executed/failed'], { tipo: 'verde' })
  d.caixa(55, 245, 270, 90, 'Qualquer SARIF 2.1.0', ['Semgrep, CodeQL, Snyk,', 'Sonar, Trivy'], { tipo: 'verde' })
  d.caixa(55, 355, 270, 90, 'Formato neutro', ['coverage_complete,', 'scanners_ran, findings'], { tipo: 'verde' })

  d.faixa(400, 100, 380, 360, 'aidlc-scan', { cor: 'destaqueFundo', borda: 'destaque' })
  d.caixa(420, 135, 340, 90, '1. Normaliza', ['formato, scanners, cobertura,', 'achados com chave estável'], { tipo: 'destaque' })
  d.caixa(420, 245, 340, 90, '2. Confere a cobertura', ['completa? scanner exigido rodou?', 'o baseline também?'], { tipo: 'destaque' })
  d.caixa(420, 355, 340, 90, '3. Aplica o limite', ['--fail-on high (padrão)', '--baseline mostra o que mudou'], { tipo: 'destaque' })
  d.seta([[325, 180], [372, 180], [372, 180], [420, 180]])
  d.seta([[325, 290], [372, 290], [372, 180], [420, 180]], { tracejado: true })
  d.seta([[325, 400], [372, 400], [372, 180], [420, 180]], { tracejado: true })

  d.faixa(840, 100, 320, 360, 'Código de saída')
  d.caixa(855, 135, 290, 90, '0  limpo', ['cobertura completa e nada', 'no limite ou acima'], { tipo: 'verde' })
  d.caixa(855, 245, 290, 90, '1  reprovado', ['achado no limite ou acima'], { tipo: 'vermelho' })
  d.caixa(855, 355, 290, 90, '2  não rodou', ['cobertura incompleta ou', 'desconhecida: nunca é limpo'], { tipo: 'ambar' })
  d.seta([[760, 180], [855, 180]])
  d.seta([[760, 290], [855, 290]])
  d.seta([[760, 400], [855, 400]])

  d.caixa(40, 500, 540, 150, 'No manifesto, é um gate comum', ['{ "id": "scan", "blocking": true,', '  "cmd": "aidlc-scan reports/seguranca.json', '          --require-scanners semgrep,trivy" }'], { mono: true, tipo: 'neutro' })
  d.caixa(620, 500, 540, 150, 'Por que 2 e não 1', ['Um relatório vazio pode ser "nada achado"', 'ou "o scanner caiu". Sem separar, uma plataforma', 'fora do ar parece uma base limpa.'], { tipo: 'ambar' })
}

// 7 ------------------------------------------------------------------------------------------
function multiferramenta(d) {
  d.titulo('Uma fonte de instruções, três ferramentas', 'AGENTS.md é a única que se edita. As outras são derivadas, e o CI reprova divergência.')
  d.caixa(40, 200, 270, 130, 'AGENTS.md', ['a fonte única', 'regras, fases, comandos'], { tipo: 'destaque' })
  d.caixa(450, 110, 330, 90, 'CLAUDE.md', ['importa @AGENTS.md', 'mais o que é só do Claude Code'], { tipo: 'neutro' })
  d.caixa(450, 230, 330, 90, '.kiro/steering/aidlc.md', ['cópia derivada, inclusion: always'], { tipo: 'neutro' })
  d.caixa(450, 350, 330, 90, '.github/copilot-instructions.md', ['cópia derivada'], { tipo: 'neutro' })
  d.seta([[310, 265], [380, 265], [380, 155], [450, 155]])
  d.seta([[380, 275], [450, 275]])
  d.seta([[310, 265], [380, 265], [380, 395], [450, 395]])
  d.texto(388, 147, '@import', { tam: 11 })
  d.texto(388, 268, 'sync', { tam: 11 })
  d.texto(388, 387, 'sync', { tam: 11 })

  d.caixa(860, 110, 300, 90, 'Claude Code', ['hooks e gate bloqueiam'], { tipo: 'verde' })
  d.caixa(860, 230, 300, 90, 'Kiro', ['instruções; o CI cobra'], { tipo: 'ambar' })
  d.caixa(860, 350, 300, 90, 'GitHub Copilot', ['instruções; o CI cobra'], { tipo: 'ambar' })
  d.seta([[780, 155], [860, 155]])
  d.seta([[780, 275], [860, 275]])
  d.seta([[780, 395], [860, 395]])

  d.caixa(40, 490, 540, 110, 'aidlc-init', ['cria o esqueleto do projeto', '--check: reprova se uma cópia divergiu', '--sync: regenera as cópias a partir do AGENTS.md'], { mono: false })
  d.caixa(620, 490, 540, 110, 'No CI (aidlc-gate.yml)', ['roda aidlc-init --check e aidlc-gate', 'é isso que cobra em Kiro e Copilot,', 'onde não existe hook bloqueante'], { tipo: 'ambar' })
}

// 8 ------------------------------------------------------------------------------------------
function instalacao(d) {
  d.titulo('Instalação, do clone ao primeiro gate', 'Uma máquina, uma vez; depois, um comando por projeto.')
  const passos = [
    ['Obter o kit', ['git clone do repositório', 'ou o marketplace aidlc'], 'neutro'],
    ['scripts/setup.mjs', ['põe os aidlc-* no PATH', '--check e --uninstall'], 'destaque'],
    ['Plugin no Claude Code', ['marketplace add e', 'plugin install'], 'destaque'],
    ['aidlc-init', ['esqueleto do projeto e', 'instruções das 3 IAs'], 'verde'],
    ['doctor e gate', ['nota do repositório e o', 'critério de aceite rodando'], 'verde'],
  ]
  passos.forEach(([titulo, linhas, tipo], i) => {
    const x = 40 + i * 226
    d.caixa(x, 130, 210, 110, titulo, linhas, { tipo })
    d.passo(x + 12, 118, i + 1)
    if (i < passos.length - 1) d.seta([[x + 210, 185], [x + 226, 185]])
  })
  d.caixa(40, 300, 540, 130, 'Opcional, por clone', ['node scripts/install-git-hooks.mjs', 'instala o pre-push que roda o aidlc-gate', 'e nunca sobrescreve hook alheio'], { mono: false })
  d.caixa(620, 300, 540, 130, 'Para publicar o seu fork', ['node scripts/definir-dono.mjs --owner <org>', 'troca os marcadores de dono e de', 'contato; --check lista o que falta'], { mono: false })
  d.caixa(40, 470, 1120, 100, 'Sem dependências de execução', ['O kit é Node puro: não há npm install nem yarn install para o kit em si. Requer Node 20.19 ou mais novo e git.'], { tipo: 'verde' })
}

// 9 ------------------------------------------------------------------------------------------
function evidencia(d) {
  d.titulo('Como o Stop decide: pronto exige evidência', 'dod-check lê a árvore, o manifesto e o transcript. Nunca prende: tem saída em todo caminho.')
  d.caixa(40, 120, 220, 80, 'Agente quer parar', ['fim do turno'], { tipo: 'neutro' })
  d.caixa(310, 120, 240, 80, 'Árvore mudou?', ['git status do projeto'], { tipo: 'destaque' })
  d.caixa(600, 120, 240, 80, 'Tecnologia conhecida?', ['detecção pelo conteúdo'], { tipo: 'destaque' })
  d.caixa(890, 120, 270, 80, 'Evidência no chat?', ['markers do manifesto'], { tipo: 'destaque' })
  d.seta([[260, 160], [310, 160]])
  d.seta([[550, 160], [600, 160]], { rotulo: 'sim' })
  d.seta([[840, 160], [890, 160]], { rotulo: 'sim' })

  d.caixa(310, 260, 240, 74, 'Libera', ['não houve entrega a provar'], { tipo: 'verde' })
  d.caixa(600, 260, 240, 74, 'Libera', ['sem critério, sem cobrança'], { tipo: 'verde' })
  d.caixa(890, 260, 270, 74, 'Libera', ['o gate foi colado'], { tipo: 'verde' })
  d.seta([[430, 200], [430, 260]], { rotulo: 'não' })
  d.seta([[720, 200], [720, 260]], { rotulo: 'não' })
  d.seta([[1025, 200], [1025, 260]], { rotulo: 'sim' })

  d.caixa(890, 380, 270, 100, 'Recusa o fim do turno', ['lista o que falta: saída do', 'gate, print, veredito do revisor'], { tipo: 'ambar' })
  d.seta([[1160, 160], [1180, 160], [1180, 430], [1160, 430]], { rotulo: 'não', cor: 'ambar' })

  d.caixa(40, 380, 800, 100, 'Salvaguardas para nunca virar prisão', ['3 recusas na mesma sessão: vira aviso e libera', 'AIDLC_GATE=0 desliga; gate_mode aceita block, warn e off', 'falha ao gravar o registro de auditoria nunca segura o Stop'], { tipo: 'neutro' })
  d.caixa(40, 530, 1120, 90, 'Por que isso importa', ['Um gate que prende é desligado na primeira semana. O desenho aposta em cobrar pouco, sempre, e deixar saída.'], { tipo: 'roxo' })
}

// 10 -----------------------------------------------------------------------------------------
function roqueshield(d) {
  d.titulo('RoqueShield e o kit: o laço de varredura', 'A plataforma acha, o kit cobra o resultado, o agente corrige. Qualquer outra plataforma entra no mesmo lugar.')

  d.faixa(40, 100, 330, 320, 'RoqueShield (plataforma)', { cor: 'verdeFundo', borda: 'verde' })
  d.caixa(60, 135, 290, 85, '1. Varredura', ['Semgrep, Trivy, ZAP, Nuclei...', '15 adaptadores, um contrato'], { tipo: 'verde' })
  d.caixa(60, 235, 290, 85, '2. Triagem', ['a IA reclassifica e deduplica', 'por deduped_key'], { tipo: 'verde' })
  d.caixa(60, 335, 290, 65, '3. AI Fix Bundle', ['JSON, schema 1.0.0'], { tipo: 'verde' })

  d.faixa(430, 100, 340, 320, 'aidlc-harness (o kit)', { cor: 'destaqueFundo', borda: 'destaque' })
  d.caixa(450, 135, 300, 100, 'aidlc-scan', ['lê o bundle (roqueshield)', 'a cobertura está completa?', 'o scanner exigido rodou?'], { tipo: 'destaque' })
  d.caixa(450, 250, 300, 85, 'Gate no manifesto', ['aidlc-gate chama o aidlc-scan', 'o hook de Stop cobra a saída'], { tipo: 'destaque' })
  d.caixa(450, 350, 300, 50, '0 limpo · 1 reprovado · 2 não rodou', [], { tipo: 'destaque', tamanho: 12 })

  d.faixa(830, 100, 330, 320, 'Agente de IA', { cor: 'roxoFundo', borda: 'roxo' })
  d.caixa(850, 135, 290, 100, '4. Corrige', ['lê o bundle por patch_priority', 'edita o código', 'Claude Code, Kiro ou Copilot'], { tipo: 'roxo' })
  d.caixa(850, 250, 290, 85, '5. Varre de novo', ['mesmo alvo, novo relatório', 'aidlc-scan --baseline antes'], { tipo: 'roxo' })
  d.caixa(850, 350, 290, 50, 'Para quando o scan limpa', [], { tipo: 'roxo', tamanho: 12 })

  d.seta([[350, 185], [450, 185]], { rotulo: 'bundle', cor: 'verde' })
  d.seta([[770, 185], [850, 185]], { rotulo: 'decide', cor: 'destaque' })
  d.seta([[995, 420], [995, 455], [240, 455], [240, 420]], { rotulo: 'repete até o scan limpar com a cobertura ainda completa', cor: 'roxo' })

  d.caixa(40, 495, 540, 120, 'Qualquer outra plataforma entra igual', ['SARIF 2.1.0: Semgrep, CodeQL, Trivy e outras', 'Formato neutro: uma conversão curta', 'Só mudam o --format e o nome do scanner'], { tipo: 'verde' })
  d.caixa(620, 495, 540, 120, 'O que o kit não presume', ['Que a plataforma esteja no ar: sem relatório,', 'a saída é 2 (não rodou), nunca limpo.', 'Integração validada contra a documentação dela.'], { tipo: 'ambar' })
}

// Marca ---------------------------------------------------------------------------------------
/** O desenho do logo: um portao (arco) com a marca de verificado dentro. Original, geometrico. */
const marca = (cx, cy, r) => (t) =>
  `<g>` +
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${t.destaqueFundo}" stroke="${t.destaque}" stroke-width="${r * 0.07}"/>` +
  `<path d="M${cx - r * 0.46} ${cy + r * 0.5} L${cx - r * 0.46} ${cy - r * 0.1} A${r * 0.46} ${r * 0.46} 0 0 1 ${cx + r * 0.46} ${cy - r * 0.1} L${cx + r * 0.46} ${cy + r * 0.5}" fill="none" stroke="${t.destaque}" stroke-width="${r * 0.09}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="M${cx - r * 0.2} ${cy + r * 0.12} L${cx - r * 0.04} ${cy + r * 0.28} L${cx + r * 0.24} ${cy - r * 0.12}" fill="none" stroke="${t.verde}" stroke-width="${r * 0.1}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `</g>`

function logo(d) {
  d.bruto(marca(128, 128, 112))
}

function social(d) {
  d.bruto((t) => `<rect width="1280" height="640" fill="${t.fundo}"/>`)
  d.bruto(marca(220, 320, 130))
  d.texto(400, 290, 'aidlc-harness', { tam: 72, cor: 'texto', negrito: true })
  d.texto(402, 345, 'Pronto exige evidência. Regra sem mecanismo é decoração.', { tam: 28, cor: 'suave' })
  let x = 402
  for (const [txt, tipo] of [['Claude Code', 'destaque'], ['Kiro', 'destaque'], ['GitHub Copilot', 'destaque']]) x = d.chip(x, 392, txt, { tipo, mono: false }).d + 10
  x = 402
  for (const [txt, tipo] of [['AI-DLC', 'verde'], ['qualquer plataforma de segurança', 'verde']]) x = d.chip(x, 428, txt, { tipo, mono: false }).d + 10
  d.texto(402, 520, 'Kit de qualidade de código aberto (MIT) para desenvolver com agentes de IA', { tam: 20, cor: 'suave' })
}

export const DIAGRAMAS = [
  { arquivo: 'contexto', desc: 'Contexto do sistema', largura: 1200, altura: 720, desenha: contexto },
  { arquivo: 'containers', desc: 'Containers do plugin', largura: 1200, altura: 740, desenha: containers },
  { arquivo: 'hooks', desc: 'Ciclo de vida dos hooks', largura: 1200, altura: 700, desenha: hooks },
  { arquivo: 'fases', desc: 'Fases do AI-DLC e aprovação humana', largura: 1200, altura: 680, desenha: fases },
  { arquivo: 'camadas', desc: 'Camadas de manifesto', largura: 1200, altura: 670, desenha: camadas },
  { arquivo: 'varredura', desc: 'Contrato de varredura', largura: 1200, altura: 680, desenha: varredura },
  { arquivo: 'multiferramenta', desc: 'Uma fonte de instruções, três ferramentas', largura: 1200, altura: 630, desenha: multiferramenta },
  { arquivo: 'instalacao', desc: 'Instalação', largura: 1200, altura: 600, desenha: instalacao },
  { arquivo: 'evidencia', desc: 'Como o Stop decide', largura: 1200, altura: 650, desenha: evidencia },
  { arquivo: 'logo', desc: 'Logo do aidlc-harness', largura: 256, altura: 256, desenha: logo },
  { arquivo: 'social-preview', desc: 'aidlc-harness: kit de qualidade para desenvolver com agentes de IA', largura: 1280, altura: 640, desenha: social },
  { arquivo: 'roqueshield', desc: 'RoqueShield e o kit: o laço de varredura', largura: 1200, altura: 650, desenha: roqueshield },
]

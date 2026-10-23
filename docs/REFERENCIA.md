# Referência

> Tudo o que o kit tem, uma peça por vez: o que faz, como se chama, o que devolve e como desligar. Para entender **por que** é assim, leia [ARQUITETURA.md](ARQUITETURA.md) e [ESTRATEGIA.md](ESTRATEGIA.md). Para começar do zero, [COMECAR.md](COMECAR.md).
>
> Este arquivo é conferido por `scripts/check-reference.mjs`: um hook, executável, comando, agente ou skill que exista no disco e não apareça aqui reprova o CI, e um comando citado na prosa que não exista também.

Índice: [Executáveis](#executáveis) · [Hooks](#hooks) · [Comandos](#comandos-slash) · [Agentes](#agentes) · [Skills](#skills) · [Manifestos de qualidade](#manifestos-de-qualidade) · [Arquivos do projeto](#arquivos-do-projeto) · [Variáveis de ambiente](#variáveis-de-ambiente-e-configuração) · [Códigos de saída](#códigos-de-saída)

---

## Executáveis

Programas Node sem dependência, instalados no `PATH` por `node scripts/setup.mjs`. Não gastam token: rodam fora do modelo. Todos aceitam `--json` quando há saída para máquina.

| Executável | Para que serve |
| --- | --- |
| [`aidlc-init`](#aidlc-init) | Prepara um projeto: instruções para as três ferramentas, pastas do ciclo, workflow de CI |
| [`aidlc-phase`](#aidlc-phase) | Estado das fases do AI-DLC, conferido e não declarado |
| [`aidlc-gate`](#aidlc-gate) | Roda o critério de aceite da tecnologia detectada |
| [`aidlc-scan`](#aidlc-scan) | Lê o relatório de qualquer plataforma de segurança e separa "limpo" de "não rodou" |
| [`aidlc-secscan`](#aidlc-secscan) | Varre CVE com correção publicada (Trivy embutido) |
| [`aidlc-lockcheck`](#aidlc-lockcheck) | Dependência fora do lockfile |
| [`aidlc-identity`](#aidlc-identity) | Dado pessoal ou de infraestrutura no repositório |
| [`aidlc-secrets`](#aidlc-secrets) | Cofre que o agente usa sem ver o valor |
| [`aidlc-doctor`](#aidlc-doctor) | Nota o repositório contra o padrão |
| [`aidlc-mutation`](#aidlc-mutation) | Teste de mutação nos caminhos críticos |
| [`aidlc-limpeza`](#aidlc-limpeza) | Bancada arrumada no fim de cada unidade |
| [`aidlc-cycle`](#aidlc-cycle) | Painel do ciclo, derivado do que o kit já registra |
| [`aidlc-graph`](#aidlc-graph) | Raio de impacto entre repositórios |
| [`aidlc-harness`](#aidlc-harness) | Custo de contexto sempre-ligado |

### aidlc-init

Cria o esqueleto de um projeto a partir dos modelos em `templates/`. Nunca sobrescreve sem `--force`.

```text
aidlc-init [pasta] [--name "Nome"] [--desc "uma frase"] [--tools claude,kiro,copilot]
           [--dry-run] [--force]
aidlc-init --check     # reprova se uma cópia derivada divergiu do AGENTS.md
aidlc-init --sync      # regenera as cópias a partir do AGENTS.md
```

Cria `AGENTS.md`, `CLAUDE.md` (importa o `AGENTS.md`), `.github/copilot-instructions.md`, `.kiro/steering/aidlc.md`, `context/product.md`, `.aidlc/config.json`, `.aidlc/identity.json`, `.github/workflows/aidlc-gate.yml` e a pasta `aidlc/` (inception, construction, decisions, audit). `--tools` limita quais ferramentas recebem arquivo. Sai 0; `--check` sai 1 em divergência.

### aidlc-phase

```text
aidlc-phase status                  # as duas fases, uma linha cada (sai 0)
aidlc-phase check inception         # sai 1 se a Inception estiver incompleta
aidlc-phase check construction      # exige a Inception completa E os arquivos da Construction
```

Uma fase está completa quando todos os seus arquivos existem, não têm o marcador `<!-- PREENCHER` e terminam com `Aprovado por:` e `Data:` (AAAA-MM-DD) preenchidos. O nome é recusado se for de ferramenta de IA. Sem pasta `aidlc/`, `status` sai 0 e `check` sai 1. O que o comando **não** prova: que o nome é de quem de fato aprovou (veja [AIDLC.md](AIDLC.md)).

### aidlc-gate

```text
aidlc-gate [pasta] [--only id1,id2] [--list] [--dry-run] [--json]
```

Detecta a tecnologia pelo conteúdo, junta os manifestos (kit, organização, projeto) e executa os gates na ordem. Gate de outra plataforma sai **PULADO**, nunca verde. Sai 1 se algum gate **bloqueante** reprovou, ou se um gate de agente (revisor) ficou pendente. Os resultados: PASSOU, FALHOU, PULADO, PENDENTE ([QUANDO-QUEBRA.md](QUANDO-QUEBRA.md)). Cada execução imprime a versão do kit e o hash do manifesto, para a evidência dizer contra qual critério foi medida.

### aidlc-scan

O contrato de varredura. Lê um relatório JSON já produzido por uma plataforma de segurança e responde com três resultados, não dois.

```text
aidlc-scan <relatorio.json> [--format auto|neutro|sarif|roqueshield]
                            [--fail-on info|low|medium|high|critical]    # padrão: high
                            [--baseline <relatorio-anterior.json>]
                            [--require-scanners a,b] [--json]
```

| Saída | Significa |
| --- | --- |
| `0` | **Limpo**: cobertura completa e nada no limite ou acima |
| `1` | **Reprovado**: há achado no limite ou acima |
| `2` | **Não rodou**: cobertura incompleta ou desconhecida, scanner exigido ausente, relatório ilegível ou arquivo inexistente |

Sem argumentos, imprime a ajuda e sai 2. `--baseline` compara por chave estável e mostra resolvidos, restantes e novos; um scanner que rodou no baseline e não rodou agora é "não rodou". Os formatos aceitos e o que cada um precisa trazer estão em [INTEGRACOES.md](INTEGRACOES.md).

### aidlc-secscan

```text
aidlc-secscan [--json] [--report]
```

Roda o Trivy sobre o repositório (vulnerabilidades, má configuração e segredo, severidade HIGH e CRITICAL) e reprova só o CVE que está em manifesto **do projeto**, tem versão de correção publicada e não está no allowlist com prazo. Cada bloco do allowlist precisa de `# expira: AAAA-MM-DD`; entrada vencida volta a reprovar. Sem o `trivy` instalado, **não é limpo**: a saída diz "não rodou". `--report` imprime tudo, inclusive o que não bloqueia.

### aidlc-lockcheck

```text
aidlc-lockcheck [pasta] [--since <ref>] [--json]
```

Confere, sem rede: (1) o lockfile do gerenciador declarado existe; (2) toda dependência do `package.json` aparece nele; (3) se as listas de dependência mudaram desde `HEAD` (ou `--since`), o lockfile mudou junto. Não consulta o registry nem mede reputação: isso é do agente `supply-chain-reviewer`. Sem `package.json` com dependências, não há o que travar e sai 0.

### aidlc-identity

```text
aidlc-identity [pasta] [--terms arquivo.txt] [--json]
```

Varre IPv4, MAC, e-mail, caminho de home, hostname interno, segredo (formatos conhecidos) e os termos que **o seu projeto** proíbe. Os termos vivem fora do repositório: `--terms`, a variável `AIDLC_IDENTITY_TERMS` ou `~/.config/aidlc/identity-terms.txt`, um por linha. Achado legítimo vai para `.aidlc/identity.json`, com `file` (glob), `categoria` e um `why` de pelo menos 8 caracteres; entrada sem motivo reprova. Sai 1 se achar algo, 2 se a pasta não existe. Ele acha formatos, não nomes: nome de pessoa ou de cliente só é pego se estiver na lista de termos.

### aidlc-secrets

```text
aidlc-secrets status [--json]                  # presente ou ausente, nunca o valor
aidlc-secrets set <nome>                       # prompt interativo, uma vez por máquina
aidlc-secrets template [arquivo]               # gera o arquivo em branco do que falta
aidlc-secrets import <arquivo> [--keep]        # grava tudo de uma vez e destrói o arquivo
aidlc-secrets exec <nome|grupo>... -- <cmd>    # injeta no ambiente do filho e faz exec
aidlc-secrets scrub                            # redige segredo conhecido lido do stdin
```

O valor entra no ambiente do processo filho e some com ele; nunca passa pela tela, pelo transcript nem por argumento de linha de comando. Armazenamento em `~/.config/aidlc/secrets`, modo 600. Os nomes conhecidos e os grupos estão na própria ajuda (`aidlc-secrets help`). `import` recusa, com saída 2, arquivo versionado pelo git (os valores já estão no histórico: rotacione, tire do versionamento e só então importe).

### aidlc-doctor

```text
aidlc-doctor [pasta] [--json]
```

Dá uma nota de 0 a 100 ao repositório e diz o que falta, com peso: README, `AGENTS.md`/`CLAUDE.md` abaixo de 8 KB, CHANGELOG, plugin habilitado, allowlist de permissão, `loop.md`, pre-push que roda o gate, segredo não versionado e, para repositório aberto, licença coerente, `SECURITY.md`, `CODE_OF_CONDUCT.md`, modelos de issue e PR, `CODEOWNERS`, CI sem segredo em fork e DCO. Item que só roda em outra plataforma sai marcado, nunca verde.

### aidlc-mutation

```text
aidlc-mutation [--min <score>] [--json]
```

Roda o Stryker só sobre `coverage.criticalPaths` do manifesto e devolve o score de mutação. Sem Stryker instalado, sai 1 dizendo isso: amarelo honesto, não verde fingido. Sem `criticalPaths` declarado, sai "pulado". Por padrão só relata; `--min` faz reprovar abaixo do score.

### aidlc-limpeza

```text
aidlc-limpeza [--todos <pasta>] [--frota] [--host <alvo-ssh>]... [--apagar] [--json]
```

Lista o que sobrou ao fim de uma unidade de trabalho: worktree, branch e container de sobra. Com `--apagar`, remove **só** o que o remoto já guarda (o lixo); o que perderia trabalho (worktree sujo, commit sem remoto) sai em "decidir" e nunca é apagado por ele. `--frota` inclui os servidores do `fleet/servers.json` do projeto (opcional) e `--host` acrescenta um alvo SSH avulso. Sai 0 com a linha `aidlc-limpeza: nada sobrando` e 1 enquanto houver lixo ou decisão pendente; essa linha é a evidência que o hook de Stop cobra ao fechar uma unidade.

### aidlc-cycle

```text
aidlc-cycle [pasta] [--since 30d] [--json]
```

Painel do ciclo, lido do que o kit já registra: `.claude/audit/<dia>.jsonl` (decisões do gate de evidência), `git log` em `aidlc/` (tempo entre fases) e `git rev-list` (frequência de entrega). O que não tem registro sai "não medido", nunca zero.

### aidlc-graph

```text
aidlc-graph blast <caminho|repo|contrato>    # o que mais precisa mudar, e em que ordem
aidlc-graph diagram                          # Mermaid para embutir em README e docs
aidlc-graph validate                         # integridade do grafo (roda no CI)
aidlc-graph list                             # nós e contratos
```

Lê o grafo de dependências entre repositórios (`AIDLC_GRAPH`, depois `.aidlc/graph.json`; há um exemplo em `graph/ecosystem.example.json`). É a mesma consulta que a skill `blast` usa antes de editar um contrato.

### aidlc-harness

```text
aidlc-harness [pasta] [--save] [--check] [--json]
```

Mede o custo de contexto: o **baseline sempre-ligado** (o que se paga em toda sessão e de novo em cada subagente) e o custo por arquivo tocado. `--save` grava `.claude/harness-baseline.json`; `--check` sai 1 se o baseline cresceu além da tolerância.

---

## Hooks

Processos que o Claude Code dispara. Ficam em `plugins/aidlc-harness/hooks/` e são registrados em `hooks/hooks.json`. Todos **falham para o lado de deixar trabalhar**: sem tecnologia reconhecida, sem registro legível ou diante de qualquer exceção, saem calados com 0. Só bloqueiam (saída 2 no `PreToolUse`, recusa no `Stop`) quando têm certeza.

| Evento | Hook | O que faz | Desliga com |
| --- | --- | --- | --- |
| `SessionStart` | [`session-brief`](#session-brief) | Anuncia a stack, os gates e a fase em curso | não bloqueia nada; é só contexto |
| `UserPromptSubmit` | [`strategy-map`](#strategy-map) | Reinjeta o mapa de regras; sobrevive ao `/compact` | `AIDLC_STRATEGY=0` |
| `PreToolUse` | [`scratch-guard`](#scratch-guard) | Rascunho só na pasta de scratch (opt-in) | `AIDLC_SCRATCH_GUARD=0` |
| `PreToolUse` | [`pkg-manager`](#pkg-manager) | `yarn` ou `npm`, conforme o manifesto do repo | só vale com tecnologia reconhecida |
| `PreToolUse` | [`secret-guard`](#secret-guard) | Barra comando que imprimiria segredo | `AIDLC_SECRET_GUARD=0` |
| `PostToolUse` | [`path-strategy`](#path-strategy) | Entrega a regra do arquivo que acabou de mudar | `AIDLC_STRATEGY=0` |
| `Stop` | [`promise-check`](#promise-check) | Barra "faço depois" sem ter feito | `AIDLC_PROMISE=0` |
| `Stop` | [`dod-check`](#dod-check) | Exige a evidência do manifesto no chat | `AIDLC_GATE=0` |

![Ciclo de vida dos hooks](assets/diagramas/hooks.claro.svg)

### session-brief

Dispara em `startup`, `resume` e `compact`. Escreve poucas linhas no contexto: qual é a tecnologia detectada, quais gates existem e o que precisa aparecer no chat antes de dizer que acabou, mais o núcleo do contexto de produto (`context/kernel.md`). É curto de propósito: entra no contexto de toda sessão.

### strategy-map

Dispara a cada prompt. No primeiro e a cada 8 prompts (a janela do compact), entrega o **mapa completo** (regras por caminho e revisor exigido); nos demais, uma linha curta com stack, gate e revisor. Também entrega e zera o que o `path-strategy` deixou pendente no livro-caixa da sessão, para o ponteiro não custar token duas vezes.

### scratch-guard

**Opt-in**: só age quando o projeto declara `scratchDir` em `.aidlc/config.json` ou a variável `AIDLC_SCRATCH_DIR`. Fora de um repositório, arquivo novo vai para `<scratchDir>/<tema>/`. Analisa o **caminho**, nunca o disco (o hook pode rodar num contêiner). Dotfile e pastas conhecidas do sistema sempre passam. Limitação: reconhece o home do macOS e o ponto de montagem do Cowork; em outro sistema não age.

### pkg-manager

Lê `pkgManager` do `quality/<tech>.json` do repositório **onde o comando roda** (ele acompanha `cd` dentro do comando). Repositório `yarn` rejeita `npm` e `npx`; repositório `npm` rejeita `yarn`. Sem tecnologia reconhecida, libera. Nega com saída 2 e diz o comando certo.

### secret-guard

Nega, com saída 2, o comando que **imprimiria** segredo: `cat` de chave SSH, leitura do cofre do sistema com `-w`, `env`/`printenv` despejando o ambiente, `echo` de variável de segredo conhecida, `cat` de `.env` real, de chave `.p8` ou de JSON de conta de serviço (`.env.example`, `.sample` e `.template` passam). Cita o caminho certo (`aidlc-secrets exec`). O comando que apenas **cita** o nome do arquivo (`ls .env`, `git check-ignore .env`) passa.

### path-strategy

Dispara depois de `Edit`, `Write` e `MultiEdit`. Entrega, só quando existem, três coisas sobre o caminho tocado: a regra que o governa (`strategy.paths` do manifesto), o raio de impacto entre repositórios se o arquivo for contrato (grafo) e o revisor que a stack exige antes do Stop. Cada ponteiro sai **uma vez por sessão**. Não bloqueia nem conserta.

### promise-check

Recusa encerrar o turno que **promete continuar** ("sigo no próximo ciclo", "na próxima iteração eu faço"). A regra é: ou faz agora, ou não promete. Não bloqueia pendência relatada como fato ("ficou de fora X, porque Y"), promessa condicionada a uma pessoa ("quando você disser") nem turno sem promessa. Respeita o `gate_mode`.

### dod-check

O gate de evidência. Lê o transcript desde a última mensagem da pessoa, descobre quais evidências o manifesto da tecnologia exige (`evidence`), e recusa o fim do turno se algum marcador não aparece. Determinista, sem modelo, em milissegundos. Falha para o lado de liberar: tecnologia desconhecida, árvore limpa (salvo quando o turno afirma fechar uma unidade: aí só a evidência `whenSays` é cobrada) ou teto de **3 recusas por sessão**, quando vira aviso e libera. Cada decisão é gravada em `.claude/audit/<dia>.jsonl`; falha ao gravar o registro nunca segura o Stop. Detalhes do fluxo: ![Como o Stop decide](assets/diagramas/evidencia.claro.svg)

---

## Comandos slash

Disponíveis no Claude Code com o plugin instalado. São instruções para o agente; o trabalho verificável é feito pelos executáveis.

| Comando | O que faz |
| --- | --- |
| `/inception` | Conduz a Inception: perguntas em rodadas, requisitos, histórias e unidades de trabalho, até uma pessoa aprovar. O agente não aprova nada |
| `/construction` | Conduz a Construction: desenho e plano de testes aprovados antes do código; depois, uma unidade de trabalho por vez. Argumento opcional: número da unidade |
| `/gate` | Roda `aidlc-gate` e cola a saída crua. Argumento opcional: o id de um gate |
| `/status` | Panorama do repositório em uma tela (gate, padrão, cofre, grafo, pendências), só leitura |

O texto completo de cada comando está em [PROMPTS.md](PROMPTS.md), que é **gerado** a partir de `commands/` (`node scripts/gerar-prompts.mjs`).

## Agentes

Subagentes do Claude Code, em `plugins/aidlc-harness/agents/`. A divisão segue o custo: o barato levanta, o caro decide.

| Agente | Modelo | Quando usar |
| --- | --- | --- |
| `scanner` | haiku, esforço baixo | Varredura mecânica sem julgamento: inventário, drift, diff de chaves, triagem de saída de lint. Devolve dado estruturado, não opinião |
| `supply-chain-reviewer` | haiku, esforço baixo | Depois de editar manifesto de dependência ou lockfile: o pacote existe, tem dono, o nome não imita outro, está fixado |
| `advisor` | opus, esforço alto | Sob demanda e nunca a cada turno: decisão grande, refutar um achado, destravar gate que falhou duas vezes, ação irreversível. Não herda a conversa: recebe o diff ou um briefing |

Um gate do tipo `agent` num manifesto precisa nomear um agente que exista aqui; `check-plugin.mjs` reprova o contrário.

## Skills

Em `plugins/aidlc-harness/skills/<nome>/SKILL.md`. O agente as carrega pela descrição.

| Skill | Quando |
| --- | --- |
| `aidlc-context` | Tarefa que exige julgamento de produto: nomear, escrever texto de usuário, avaliar escopo. Lê `context/product.md` |
| `blast` | **Antes** de editar arquivo que possa ser contrato entre repositórios: usa `aidlc-graph blast` |
| `bolts` | Começar ou retomar projeto grande: planejar tudo, separar em unidades (bolts), fechar cada uma com teste, evidência e limpeza |
| `repo-standard` | Trazer um repositório ao padrão do kit quando o `aidlc-doctor` estiver baixo |

---

## Manifestos de qualidade

O critério de aceite como dado. Ficam em `plugins/aidlc-harness/quality/<tech>.json`, validados por `_schema.json` (`node scripts/check-quality-manifests.mjs`).

![Camadas de manifesto](assets/diagramas/camadas.claro.svg)

### Manifestos que vêm no kit

| `tech` | Reconhece por | Gerenciador | Gates |
| --- | --- | --- | --- |
| `node-yarn` | `package.json` + `yarn.lock` | yarn | `test`, `lint`, `build`, `secscan`, `supply-chain` |
| `node-npm` | `package.json` + `package-lock.json` | npm | `test`, `lint`, `build`, `secscan`, `supply-chain` |
| `python-uv` | `pyproject.toml` + `uv.lock` | uv | `lint`, `format`, `lockfile`, `segredo`, `unit` |
| `harness-self` | a pasta do plugin + `OPERATING-MODEL.md` | n/a | `test`, `syntax`, `quality-manifests`, `plugin`, `docs`, `prompts`, `identity` |

`_org.json` é a **camada da organização**: não é tecnologia, vale para toda stack que casar o `when` (hoje o gate `lockfile` e a evidência de fechamento de unidade). Um manifesto de projeto em `.aidlc/quality/<tech>.json` com o mesmo `tech` **sobrescreve** o do kit. O modelo de gate de segurança está em `templates/security/node-yarn-com-scan.json`.

### Campos de um manifesto

| Campo | Obrigatório | O que é |
| --- | --- | --- |
| `tech`, `label`, `repos` | sim | Identificador kebab-case (igual ao nome do arquivo), nome legível, repositórios que rodam nesta stack |
| `status` | não | `active` (padrão) ou `archived` (sai de circulação: sem gate, sem loop, sem nota no doctor) |
| `pkgManager` | não | `yarn`, `npm`, `gradle`, `spm` ou `none`. Fonte da verdade do `pkg-manager` |
| `platform` | não | `any` (padrão), `darwin` ou `win32`: onde o gate consegue rodar de verdade |
| `autonomy` | não | `observe`, `advise`, `approve` (padrão) ou `breaker`: quanto o agente faz sozinho, declarado como dado |
| `detect` | sim | `allFiles` (E), `anyFiles` (OU), `packageDeps` e `priority` (maior vence; padrão 50). Olha o conteúdo, não o nome da pasta |
| `gates` | sim | Lista de gates (abaixo) |
| `evidence` | sim | O que precisa aparecer no chat antes de declarar pronto (abaixo) |
| `coverage` | não | `global`, `critical`, `criticalPaths`: alimenta o `aidlc-mutation` |
| `security` | não | Qual gate cumpre `sca`, `sast`, `pinning`, `review`. Ausente significa que **não há** barreira |
| `strategy` | não | O que ler antes de escrever, por caminho (abaixo) |
| `notes` | não | Texto livre |

**Gate**: `id`, `label`, `blocking` (obrigatórios); exatamente um entre `cmd` (comando de shell) e `agent` (revisor); `expect` (substring que a saída precisa conter), `reject` (substring que reprova), `platform`, `autonomy`, `model` (`haiku`, `sonnet`, `fable` ou `inherit`, para gate de agente), `timeoutMs` (padrão 600000) e `$why` (mínimo 40 caracteres: o defeito real que fez o gate existir; sem motivo escrito, é o primeiro que alguém remove quando incomoda).

**Evidência**: `id`, `label`, `markers` (regexes; qualquer uma satisfaz); `whenTouches` (globs: só é exigida se a sessão tocou um arquivo que casa); `whenSays` (regexes contra a última mensagem: exigida quando ela afirma o que casa, e cobrada mesmo com a árvore limpa); `$why`.

**Strategy**: `always` (ponteiros válidos para qualquer arquivo da stack) e `paths[]`, cada um com `when` (globs), `why` (uma linha: o que quebra se ignorar), `read` (regras ou documentos a abrir) e `reviewer` (agente que precisa revisar antes do Stop). O prefixo `@kit/` resolve na raiz do kit onde quer que ele esteja; ponteiro `@kit/` para arquivo inexistente reprova o check.

### O que o `check-quality-manifests` faz valer

Manifesto inválido é **ignorado e reportado**, nunca silencioso; cópia literal de gate herdado da camada da organização reprova; `inherits: false` recusa a herança; um gate tem exatamente um entre `cmd` e `agent`; regex inválida em `markers` reprova; recorte de `strategy` sem `when` reprova; ponteiro `@kit/` para arquivo inexistente reprova; agente de gate precisa existir em `agents/`.

---

## Arquivos do projeto

O que o `aidlc-init` cria e para que serve.

| Arquivo | Para quê |
| --- | --- |
| `AGENTS.md` | **A fonte única** das regras para qualquer ferramenta de IA. Único arquivo de instrução que se edita à mão |
| `CLAUDE.md` | Importa `@AGENTS.md` e acrescenta só o que é do Claude Code |
| `.github/copilot-instructions.md`, `.kiro/steering/aidlc.md` | Cópias **derivadas** do `AGENTS.md` (`aidlc-init --sync`); `--check` reprova divergência |
| `context/product.md` | O que o produto é, o que já foi decidido, o vocabulário do time |
| `context/kernel.md` | Três linhas que mudam o enquadramento, injetadas pelo `session-brief` |
| `aidlc/inception/` | `requirements.md`, `user-stories.md`, `units-of-work.md` |
| `aidlc/construction/` | `design.md`, `test-plan.md` |
| `aidlc/decisions.md` | O que foi decidido e não se reabre |
| `aidlc/audit/` | Registro das decisões do ciclo |
| `.aidlc/config.json` | `tools`, `language`, `scratchDir` (todas opcionais) |
| `.aidlc/identity.json` | Allowlist do `aidlc-identity`, cada entrada com motivo |
| `.aidlc/quality/<tech>.json` | Manifesto do projeto; sobrescreve o do kit |
| `.claude/audit/<dia>.jsonl` | Decisões do gate de evidência (alimenta o `aidlc-cycle`) |
| `.github/workflows/aidlc-gate.yml` | Roda `aidlc-init --check` e `aidlc-gate` no CI; fixa o kit por `AIDLC_REF` |

## Variáveis de ambiente e configuração

| Variável | Efeito |
| --- | --- |
| `AIDLC_GATE=0` | Desliga o gate de evidência e os outros hooks de Stop. Kill switch de emergência: vence tudo |
| `CLAUDE_PLUGIN_OPTION_GATE_MODE` | Opção `gate_mode` do plugin: `block` (padrão), `warn` ou `off`. Vale para `dod-check` e `promise-check` |
| `AIDLC_PROMISE=0` | Desliga só o `promise-check` |
| `AIDLC_SECRET_GUARD=0` | Desliga só o `secret-guard` |
| `AIDLC_STRATEGY=0` | Desliga `strategy-map` e `path-strategy` |
| `AIDLC_SCRATCH_DIR` | Pasta de rascunho; liga o `scratch-guard` sem editar `config.json` |
| `AIDLC_SCRATCH_GUARD=0` | Desliga o `scratch-guard` |
| `AIDLC_AUDIT=0` | O `dod-check` deixa de gravar `.claude/audit/` |
| `AIDLC_IDENTITY_TERMS` | Arquivo com os termos que o projeto proíbe, para o `aidlc-identity` |
| `AIDLC_GRAPH` | Caminho do grafo de repositórios para `aidlc-graph` e `path-strategy` |
| `AIDLC_REF` | No workflow de CI, a tag ou o commit do kit a usar. **Fixe numa tag ou commit que você revisou** |

## Códigos de saída

Convenção uniforme: **0** deu certo, **1** reprovou ou há pendência, **2** não deu para decidir (nunca confunda com 0).

| Comando | 0 | 1 | 2 |
| --- | --- | --- | --- |
| `aidlc-gate` | todos os bloqueantes passaram | bloqueante falhou ou revisor pendente | n/a |
| `aidlc-scan` | limpo | reprovado | **não rodou** |
| `aidlc-phase check` | fase completa | incompleta | n/a |
| `aidlc-identity` | nada achado | achou algo ou allowlist sem motivo | pasta inexistente |
| `aidlc-limpeza` | `nada sobrando` | lixo ou decisão pendente | n/a |
| Hook `PreToolUse` | libera | n/a | **bloqueia** o comando |

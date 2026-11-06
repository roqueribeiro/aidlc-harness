# Começar: a trilha em seis passos

*Tradução de [GETTING-STARTED.md](../GETTING-STARTED.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

Do zero a um projeto com o ciclo AI-DLC funcionando. Cada passo diz o que fazer, o que você deve ver e o que fazer se não vir. Tempo estimado do primeiro ao quarto passo: meia hora, a maior parte na conversa de requisitos.

Os trechos de saída abaixo vieram de uma execução real do kit (Linux, Node 22). Em outro sistema, a forma é a mesma.

## 1. O que você precisa

**Node 20.19 ou mais novo** (`node --version`) e **git**. Nada mais: nada de instalação global, de scanner para instalar ou de comando de plugin. O kit se copia para o projeto no passo 2, e tudo roda dessa cópia.

## 2. Prepare o projeto

```bash
cd meu-projeto            # um repositório git; novo ou existente
npx github:roqueribeiro/aidlc-harness init --name "Meu Projeto" --desc "Cadastro de clientes"
```

Num terminal, o `aidlc-init` pergunta com quais ferramentas de IA o time trabalha, com as que ele achou na pasta já marcadas; no CI ou com `--tools claude,cursor,copilot` ele não pergunta. Ele cria o que falta e **nunca sobrescreve** o que é seu: um `AGENTS.md` que já existe ganha as regras do kit num bloco gerenciado no fim, e arquivos de hook que já existem ganham as entradas do kit ao lado das suas. Para ver antes, use `--dry-run`.

**O que você deve ver** (com Claude Code, Cursor e Copilot escolhidos):

```
aidlc-init  /caminho/meu-projeto
  criado       AGENTS.md
  criado       CLAUDE.md
  criado       .github/copilot-instructions.md
  criado       context/product.md
  criado       context/kernel.md
  criado       .aidlc/config.json
  criado       .aidlc/identity.json
  criado       .github/workflows/aidlc-gate.yml
  criado       aidlc/README.md
  criado       aidlc/construction/design.md
  criado       aidlc/construction/test-plan.md
  criado       aidlc/decisions.md
  criado       aidlc/inception/insumos/README.md
  criado       aidlc/inception/requirements.md
  criado       aidlc/inception/units-of-work.md
  criado       aidlc/inception/user-stories.md
  criado       aidlc/audit/.gitkeep
  criado       .agents/skills/aidlc-inception/SKILL.md
  criado       .agents/skills/aidlc-construction/SKILL.md
  criado       .cursor/commands/aidlc-inception.md
  criado       .cursor/commands/aidlc-construction.md
  criado       .cursor/hooks.json
  criado       .github/prompts/aidlc-inception.prompt.md
  criado       .github/prompts/aidlc-construction.prompt.md
  criado       .github/hooks/aidlc.json
  criado       .claude/settings.json
  criado       .aidlc/COMANDOS.md
  kit          .aidlc/kit/  (103 arquivo(s) gravado(s); hooks e gate rodam daqui, sem instalar nada)

Proximo passo: ponha em aidlc/inception/insumos/ o que ja existe sobre o pedido e rode a Inception:
  Claude Code                  /inception
  Cursor                       /aidlc-inception
  GitHub Copilot               /aidlc-inception  (no VS Code; no Copilot CLI, peça a skill aidlc-inception)
```

(A linha `kit` diz que a cópia do kit foi gravada e que hooks e gate rodam dela sem instalar nada. As últimas linhas dizem o que digitar em cada ferramenta.)

**Claude Code:** o projeto agora tem `.claude/settings.json`, que registra o marketplace do kit fixado nesta versão e habilita o plugin. Abra o Claude Code na pasta e aceite o diálogo de confiança: o plugin, com hooks, agentes e o comando `/inception`, carrega sozinho. Todo colega que clonar o repositório recebe o mesmo, sem comando para rodar.

**As outras 14 ferramentas** não precisam de mais nada: o comando, as skills e, onde a ferramenta deixa, os hooks já estão no projeto. O que cada uma recebe, passo a passo, está em [FERRAMENTAS.md](FERRAMENTAS.md); a diferença de garantia está em [ADAPTADORES.md](ADAPTADORES.md).

O que é cada coisa:

| Arquivo | Para que serve |
| --- | --- |
| `AGENTS.md` | **A fonte única** das regras. Edite fora do bloco do kit (`aidlc:inicio` a `aidlc:fim`). |
| `CLAUDE.md`, `.github/copilot-instructions.md`, `.kiro/steering/aidlc.md` | Derivados do `AGENTS.md` para as ferramentas que precisam deles. `aidlc-init --check` reprova se divergirem; `--sync` regrava. |
| `.agents/skills/`, os arquivos de comando e de hook de cada ferramenta | Gerados pelos adaptadores do kit. Não edite: o `--check` reprova, o `--sync` regrava. |
| `context/product.md` | O que o produto é, para quem, o que já foi decidido e o vocabulário. **Preencha à mão**: a IA não pode inventar isso. |
| `aidlc/` | Os artefatos do ciclo, versionados com o código. `aidlc/inception/insumos/` é onde você põe o que a IA deve ler primeiro. |
| `.aidlc/config.json`, `.aidlc/COMANDOS.md` | As ferramentas escolhidas, e o que digitar em cada uma. |
| `.aidlc/identity.json` | Exceções do scanner de identidade, cada uma com motivo. |
| `.aidlc/kit/` | **Uma cópia do kit** (uns 100 arquivos). Hooks, gate e fases rodam dela: `node .aidlc/kit/tools/aidlc-gate`, `node .aidlc/kit/tools/aidlc-phase status`. Vai para o git, para o colega que clona ter tudo. Não edite: o CI roda o `--check` a partir do kit fixado e reprova cópia diferente. `npx github:roqueribeiro/aidlc-harness init --sync` atualiza. |
| `.claude/settings.json` | Só com o Claude Code: o marketplace do kit, o plugin habilitado e a permissão para rodar a cópia do kit. O que você já tinha nesse arquivo fica. |
| `.github/workflows/aidlc-gate.yml` | O CI: identidade, estado das fases, a cópia do kit e gate, com os passos de preparação da stack detectada. |

Faça o commit disso num commit só, antes de começar o trabalho.

**Confira:** `node .aidlc/kit/tools/aidlc-gate` deve sair verde. Na primeira vez numa máquina, o `aidlc-secscan` baixa o Trivy (a versão fixada no kit, conferida por sha256) para o cache do kit, o que leva uns trinta segundos; depois disso funciona sem rede. Atrás de proxy corporativo, o `HTTPS_PROXY` é respeitado; para usar o seu Trivy, ponha-o no `PATH` ou aponte `AIDLC_TRIVY` para ele.

**Edite o `context/product.md` agora.** Duas frases bastam para começar. Sem ele, o agente trabalha sem saber o que o produto é, e nas primeiras respostas você vai ver a consequência.

## 3. Inception: requisitos, histórias, unidades

Aqui a IA conduz e a equipe responde. No Claude Code:

```
/aidlc-harness:inception Quero um cadastro de clientes com busca e histórico de alterações
```

Nas outras ferramentas, o `aidlc-init` gerou o comando no formato de cada uma: o `.aidlc/COMANDOS.md` do seu projeto lista o que digitar em cada ferramenta (por exemplo `/aidlc-inception` no OpenCode, no Cursor e no VS Code, `/aidlc:inception` no Gemini CLI).

A IA deve:

1. ler `AGENTS.md`, `context/product.md`, `aidlc/decisions.md`, o código e o que você puser em `aidlc/inception/insumos/` (transcrição de reunião, briefing, print);
2. escrever **primeiro um rascunho completo**: requisitos, histórias com critérios de aceite verificáveis e unidades de trabalho, com as recomendações dela, listando em **Premissas** cada escolha que fez sozinha;
3. perguntar **só o que não pode decidir**, no máximo cinco perguntas, na janela de perguntas da própria ferramenta quando ela tem uma, com a opção recomendada primeiro; "aceitar todas as recomendações" é sempre uma resposta válida;
4. registrar suas respostas, nas suas palavras, e ajustar o rascunho.

**Seu papel:** responder, conferir as premissas, corrigir, cortar escopo. Se a IA inventar um requisito que ninguém disse, apague. Se um critério vier com adjetivo ("rápido"), exija um número.

**Fechamento da fase:** quando os três arquivos estiverem preenchidos, **uma pessoa** escreve o nome e a data em `Aprovado por:` e `Data:` de cada arquivo, e em `Premissas revisadas por:` no `requirements.md` quando ele lista premissas. Depois:

```bash
node .aidlc/kit/tools/aidlc-phase check inception
```

Enquanto houver pendência, a saída lista cada uma (trecho real):

```
  aidlc/inception/requirements.md: 7 campo(s) por preencher (marcador PREENCHER)
  aidlc/inception/requirements.md: "Aprovado por:" em branco
aidlc-phase: inception INCOMPLETA
```

O comando sai com código 1 enquanto estiver incompleta. Se a IA escrever o próprio nome na aprovação, ele também reprova:

```
  aidlc/inception/requirements.md: "Aprovado por: Claude" nao vale, a aprovacao e de uma pessoa
```

Quando tudo estiver certo: `aidlc-phase: inception completa`, e `aidlc-phase status` mostra a Construction liberada.

**Limite honesto:** o kit confere que a aprovação **existe e não é de uma IA**. Que o nome escrito seja de quem de fato aprovou é responsabilidade da equipe, por exemplo exigindo revisão do pull request que comita a assinatura.

## 4. Construction: desenho e plano de testes

```
/aidlc-harness:construction
```

(Em Kiro ou Copilot: [PROMPTS.md](PROMPTS.md#construction).)

A IA começa rodando `aidlc-phase check inception`. Se a Inception não estiver completa, ela para. Depois propõe o desenho com alternativas e seus custos, pergunta o que só a equipe sabe (padrões internos, plataformas aprovadas, dados sensíveis) e escreve `aidlc/construction/design.md` e `test-plan.md`. O plano de testes liga **cada critério de aceite** a um teste, e diz o que continua sem verificação.

Assine os dois arquivos como no passo anterior e rode `aidlc-phase check construction`.

## 5. Código, uma unidade por vez

Com as duas fases aprovadas, o trabalho segue a skill `bolts` (veja [`skills/bolts/SKILL.md`](../../plugins/aidlc-harness/skills/bolts/SKILL.md)):

1. branch curta por unidade;
2. teste e código no mesmo diff; um check novo nasce com um **mutante** (quebre o código de propósito e confirme que o teste reprova);
3. `node .aidlc/kit/tools/aidlc-gate` e **a saída crua colada no chat**. No Claude Code, o hook de Stop recusa encerrar o turno que diz "pronto" sem a evidência que o manifesto da tecnologia declara;
4. dependência nova passa pelo `supply-chain-reviewer`;
5. `aidlc-identity` limpo antes de abrir o pull request.

O kit reconhece 10 stacks (Node com npm, yarn, pnpm ou bun, Python com uv, Java com Maven ou Gradle, .NET e Go). Se a sua não estiver entre elas, o `aidlc-gate` não vai reconhecê-la. Acrescente um manifesto em `.aidlc/quality/<tech>.json` ([ESTENDER.md](ESTENDER.md)).

## 6. Feche e meça

Ao terminar uma unidade:

```bash
node .aidlc/kit/tools/aidlc-limpeza --apagar   # worktrees, branches e containers de sobra
node .aidlc/kit/tools/aidlc-doctor             # nota do repositório e o que falta
node .aidlc/kit/tools/aidlc-cycle              # lead time das fases, taxa de bloqueio do gate
```

A linha `aidlc-limpeza: nada sobrando` é a evidência que o hook de Stop cobra quando a mensagem diz que uma unidade fechou. Decisões que ficaram de pé vão para `aidlc/decisions.md`.

## Quando algo não funciona

- `aidlc-gate` diz que não reconhece a tecnologia: o projeto não tem `package.json` + lockfile (ou `pyproject.toml` + `uv.lock`). Veja [ESTENDER.md](ESTENDER.md).
- O gate "pulou" algo: pulado não é verde. [QUANDO-QUEBRA.md](QUANDO-QUEBRA.md) explica PASSOU, FALHOU, PULADO e PENDENTE.
- O plugin não carregou no Claude Code: `claude plugin validate <pasta do plugin>` e `/reload-plugins`.
- O `aidlc-identity` achou algo legítimo (um e-mail de contato público, por exemplo): registre em `.aidlc/identity.json` com o motivo. Entrada sem motivo é recusada.

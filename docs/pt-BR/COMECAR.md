# Começar: a trilha em sete passos

*Tradução de [GETTING-STARTED.md](../GETTING-STARTED.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

Do zero a um projeto com o ciclo AI-DLC funcionando. Cada passo diz o que fazer, o que você deve ver e o que fazer se não vir. Tempo estimado do primeiro ao quinto passo: meia hora, a maior parte na conversa de requisitos.

Os trechos de saída abaixo vieram de uma execução real do kit (Linux, Node 22). Em outro sistema, a forma é a mesma.

## 1. Instale o kit na sua máquina

Pré-requisitos: **Node 20.19 ou mais novo** (`node --version`) e **git**.

```bash
npm install -g github:roqueribeiro/aidlc-harness
```

Isso põe todos os executáveis `aidlc-*` no seu `PATH`, em Linux, macOS e Windows (no Windows o npm cria os atalhos `.cmd`). Os hooks do GitHub Copilot, do Cursor e do Codex chamam o `aidlc-hook` pelo nome, então precisam deste passo. Se você só quer experimentar, pule e use `npx github:roqueribeiro/aidlc-harness <comando>` nos próximos passos.

**Confira:** `aidlc-gate --list` lista as tecnologias que o kit conhece (10 hoje, de Node a Java, .NET e Go).

## 2. Ligue o kit à sua ferramenta

**Claude Code** (plugin com hooks que bloqueiam, agentes e skills):

```bash
claude plugin marketplace add roqueribeiro/aidlc-harness
claude plugin install aidlc-harness@aidlc
```

Dentro de uma sessão, `/reload-plugins` e depois `/context` devem mostrar o `aidlc-harness` com os agentes e os hooks.

**As outras 14 ferramentas** não precisam de nada além do passo 3: o `aidlc-init` grava no projeto o comando, as skills e, onde a ferramenta deixa, os hooks. O que cada uma recebe, passo a passo, está em [FERRAMENTAS.md](FERRAMENTAS.md); a diferença de garantia está em [ADAPTADORES.md](ADAPTADORES.md).

## 3. Prepare o projeto

```bash
cd meu-projeto            # um repositório git; novo ou existente
aidlc-init --name "Meu Projeto" --desc "Cadastro de clientes"
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
  criado       .aidlc/COMANDOS.md

Proximo passo: ponha em aidlc/inception/insumos/ o que ja existe sobre o pedido e rode a Inception:
  Claude Code                  /inception
  Cursor                       /aidlc-inception
  GitHub Copilot               /aidlc-inception  (no VS Code; no Copilot CLI, peça a skill aidlc-inception)
```

(As últimas linhas dizem o que digitar em cada ferramenta.)

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
| `.github/workflows/aidlc-gate.yml` | O CI: identidade, estado das fases e gate, com os passos de preparação da stack detectada. |

Faça o commit disso num commit só, antes de começar o trabalho.

**Edite o `context/product.md` agora.** Duas frases bastam para começar. Sem ele, o agente trabalha sem saber o que o produto é, e nas primeiras respostas você vai ver a consequência.

## 4. Inception: requisitos, histórias, unidades

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
aidlc-phase check inception
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

## 5. Construction: desenho e plano de testes

```
/aidlc-harness:construction
```

(Em Kiro ou Copilot: [PROMPTS.md](PROMPTS.md#construction).)

A IA começa rodando `aidlc-phase check inception`. Se a Inception não estiver completa, ela para. Depois propõe o desenho com alternativas e seus custos, pergunta o que só a equipe sabe (padrões internos, plataformas aprovadas, dados sensíveis) e escreve `aidlc/construction/design.md` e `test-plan.md`. O plano de testes liga **cada critério de aceite** a um teste, e diz o que continua sem verificação.

Assine os dois arquivos como no passo anterior e rode `aidlc-phase check construction`.

## 6. Código, uma unidade por vez

Com as duas fases aprovadas, o trabalho segue a skill `bolts` (veja [`skills/bolts/SKILL.md`](../../plugins/aidlc-harness/skills/bolts/SKILL.md)):

1. branch curta por unidade;
2. teste e código no mesmo diff; um check novo nasce com um **mutante** (quebre o código de propósito e confirme que o teste reprova);
3. `aidlc-gate` e **a saída crua colada no chat**. No Claude Code, o hook de Stop recusa encerrar o turno que diz "pronto" sem a evidência que o manifesto da tecnologia declara;
4. dependência nova passa pelo `supply-chain-reviewer`;
5. `aidlc-identity` limpo antes de abrir o pull request.

Instale o gancho de pre-push para o gate rodar antes de o push sair:

```bash
node aidlc-harness/scripts/install-git-hooks.mjs
```

Se a sua stack não for Node (yarn ou npm) ou Python (uv), o `aidlc-gate` não vai reconhecê-la. Acrescente um manifesto em `.aidlc/quality/<tech>.json` ([ESTENDER.md](ESTENDER.md)).

## 7. Feche e meça

Ao terminar uma unidade:

```bash
aidlc-limpeza --apagar     # worktrees, branches e containers de sobra
aidlc-doctor               # nota do repositório e o que falta
aidlc-cycle                # lead time das fases, taxa de bloqueio do gate
```

A linha `aidlc-limpeza: nada sobrando` é a evidência que o hook de Stop cobra quando a mensagem diz que uma unidade fechou. Decisões que ficaram de pé vão para `aidlc/decisions.md`.

## Quando algo não funciona

- `aidlc-gate` diz que não reconhece a tecnologia: o projeto não tem `package.json` + lockfile (ou `pyproject.toml` + `uv.lock`). Veja [ESTENDER.md](ESTENDER.md).
- O gate "pulou" algo: pulado não é verde. [QUANDO-QUEBRA.md](QUANDO-QUEBRA.md) explica PASSOU, FALHOU, PULADO e PENDENTE.
- O plugin não carregou no Claude Code: `claude plugin validate <pasta do plugin>` e `/reload-plugins`.
- O `aidlc-identity` achou algo legítimo (um e-mail de contato público, por exemplo): registre em `.aidlc/identity.json` com o motivo. Entrada sem motivo é recusada.

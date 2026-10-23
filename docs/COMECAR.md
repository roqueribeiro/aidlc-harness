# Começar: a trilha em sete passos

Do zero a um projeto com o ciclo AI-DLC funcionando. Cada passo diz o que fazer, o que você deve ver e o que fazer se não vir. Tempo estimado do primeiro ao quinto passo: meia hora, a maior parte na conversa de requisitos.

Os trechos de saída abaixo vieram de uma execução real do kit (Linux, Node 22). Em outro sistema, a forma é a mesma.

## 1. Instale o kit na sua máquina

Pré-requisitos: **Node 20.19 ou mais novo** (`node --version`) e **git**.

```bash
git clone https://github.com/roqueribeiro/aidlc-harness.git
node aidlc-harness/scripts/setup.mjs
```

O `setup` põe os executáveis `aidlc-*` num diretório do seu PATH (`~/.local/bin` no macOS e Linux, `%USERPROFILE%\.aidlc\bin` no Windows). Ele nunca sobrescreve um arquivo que não seja dele.

**O que você deve ver:** uma linha por executável e, no fim, `setup: 13 executáveis em <diretório>`. Se o diretório não estiver no PATH, o `setup` avisa: acrescente-o ao PATH do seu shell e abra um terminal novo.

**Confira:** `aidlc-gate --list` lista as tecnologias que o kit conhece.

**Windows:** o `setup` gera atalhos `.cmd`. Isso **não foi testado** em Windows real. Se falhar, rode os executáveis por `node <caminho>\plugins\aidlc-harness\tools\aidlc-gate` e abra uma issue com a saída.

## 2. Ligue o kit na sua ferramenta

**Claude Code** (onde os hooks bloqueiam de verdade):

```bash
claude plugin marketplace add roqueribeiro/aidlc-harness
claude plugin install aidlc-harness@aidlc
```

Dentro de uma sessão, `/reload-plugins` e depois `/context` devem mostrar o `aidlc-harness` com os agentes e hooks. Para uma cópia local do repositório, use o caminho em vez de `roqueribeiro/aidlc-harness`.

**Kiro e GitHub Copilot** não carregam plugin do Claude Code. Eles recebem as instruções do projeto (passo 3) e usam os executáveis do passo 1 pelo terminal. A diferença de garantia está em [ADAPTADORES.md](ADAPTADORES.md): lá o que cobra o "pronto" é o CI, não um hook.

## 3. Prepare o projeto

```bash
cd meu-projeto            # um repositório git; pode ser novo ou existente
aidlc-init --name "Meu Projeto" --desc "Cadastro de clientes"
```

`aidlc-init` cria o que falta e **nunca sobrescreve**. Para ver antes, use `--dry-run`. Para gerar instruções só de algumas ferramentas, `--tools claude,copilot`.

**O que você deve ver:**

```
aidlc-init  /caminho/meu-projeto
  criado       AGENTS.md
  criado       CLAUDE.md
  criado       .github/copilot-instructions.md
  criado       .kiro/steering/aidlc.md
  criado       context/product.md
  criado       context/kernel.md
  criado       .aidlc/config.json
  criado       .aidlc/identity.json
  criado       .github/workflows/aidlc-gate.yml
  criado       aidlc/README.md
  criado       aidlc/inception/requirements.md   (e user-stories.md, units-of-work.md)
  criado       aidlc/construction/design.md      (e test-plan.md)
  criado       aidlc/decisions.md
```

O que cada coisa é:

| Arquivo | Para quê |
| --- | --- |
| `AGENTS.md` | **A fonte única** das instruções. Edite só este. |
| `CLAUDE.md`, `.github/copilot-instructions.md`, `.kiro/steering/aidlc.md` | Derivados do `AGENTS.md`. `aidlc-init --check` falha se divergirem; `--sync` regrava. |
| `context/product.md` | O que o produto é, para quem, o que já foi decidido e o vocabulário. **Preencha na mão**: a IA não deve inventar isto. |
| `aidlc/` | Os artefatos do ciclo, versionados com o código. |
| `.aidlc/config.json` | Configuração do kit neste projeto (todas as chaves são opcionais). |
| `.aidlc/identity.json` | Exceções ao scanner de identidade, cada uma com motivo. |
| `.github/workflows/aidlc-gate.yml` | O CI: identidade, estado das fases e gate. |

Comite isto num commit só, antes de começar o trabalho.

**Edite `context/product.md` agora.** Duas frases bastam para começar. Sem isso, o agente trabalha sem saber o que o produto é, e nas primeiras respostas você vai ver a consequência.

## 4. Inception: requisitos, histórias, unidades

Aqui a IA conduz e a equipe responde. No Claude Code:

```
/aidlc-harness:inception Quero um cadastro de clientes com busca e histórico de alterações
```

Em Kiro ou Copilot, cole o texto de [PROMPTS.md](PROMPTS.md#inception) no chat do agente.

A IA deve:

1. ler `AGENTS.md`, `context/product.md` e `aidlc/decisions.md`;
2. perguntar **em rodadas de no máximo cinco perguntas**, com opções e uma recomendação, esperando suas respostas;
3. registrar as respostas, nas suas palavras, em `aidlc/inception/requirements.md`;
4. propor histórias com critérios de aceite verificáveis, e depois as unidades de trabalho.

**Seu papel:** responder, corrigir, cortar escopo. Se a IA inventar um requisito que ninguém disse, apague. Se um critério vier com adjetivo ("rápido"), exija um número.

**Fechamento da fase:** quando os três arquivos estiverem preenchidos, **uma pessoa** escreve o nome e a data em `Aprovado por:` e `Data:` de cada arquivo. Depois:

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

Com as duas fases aprovadas, o trabalho segue a skill `bolts` (veja [`skills/bolts/SKILL.md`](../plugins/aidlc-harness/skills/bolts/SKILL.md)):

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

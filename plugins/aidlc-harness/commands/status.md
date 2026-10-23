---
description: 'Panorama do repo em uma tela: gate, padrão, cofre, grafo e o que está pendente. Read-only.'
argument-hint: '[caminho do repo, padrão: o atual]'
allowed-tools: Bash, Read, Glob, Grep
---

Mostre o estado deste repositório em **uma tela**, para ser lido no celular.

Alvo: $1 (se vazio, o diretório atual).

Rode os quatro, em paralelo quando puder:

```bash
aidlc-harness --json     # o que o kit carrega aqui
aidlc-doctor --json .    # nota contra o padrão do kit
aidlc-gate --list        # os gates da tecnologia detectada
aidlc-secrets status     # presente/ausente, nunca valor
```

E o estado do git: branch, quantos commits à frente e atrás, e se a árvore está suja.

## Como reportar

Uma tabela curta e depois **no máximo três linhas** do que merece ação. Nada mais.

| O que | Estado |
| --- | --- |
| Tecnologia | o que o gate detectou |
| Padrão | nota do doctor, e o que falta se for menos de 100 |
| Gate | quantos gates, quais bloqueiam |
| Cofre | n de N, com N lido de `aidlc-secrets status` e nunca escrito à mão, listando só os ausentes que esta stack usa |
| Git | branch, à frente/atrás, sujo ou limpo |

Regras:

- **Não rode o gate.** Este comando é panorama, não execução. Quem roda é `/aidlc-harness:gate`.
- Não altere arquivo nenhum.
- Se estiver tudo verde, diga isso em uma linha e pare. Não invente trabalho.
- Se o `aidlc-doctor` estiver abaixo de 90, ofereça a skill `repo-standard` em uma linha, sem executá-la.

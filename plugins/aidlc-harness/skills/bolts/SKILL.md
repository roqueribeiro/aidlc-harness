---
name: bolts
description: 'A cadência de entrega do ciclo AI-DLC: planejar tudo, separar em unidades de trabalho (bolts), executar até fechar cada uma com teste, evidência, principal atualizada e limpeza. Use ao começar ou retomar um projeto, fase ou pedido grande ("planeje", "próximos passos", "faça tudo", "siga com o projeto").'
allowed-tools: Bash, Read, Glob, Grep, Edit, Write
---

# /bolts

Uma unidade de trabalho (bolt) é uma entrega pequena o bastante para fechar em horas ou poucos dias, com critério de aceite medível. Este skill descreve como planejar e fechar uma, em uma sequência que o kit consegue conferir.

O vocabulário é inspirado no AI-DLC, e não é a documentação da AWS. A relação com as fases está em `docs/AIDLC.md`.

## 1. Planejar antes da primeira linha de código

- Leia o que já existe: `aidlc/` do projeto (`aidlc-phase status` mostra o que está aprovado), `context/product.md` (via `aidlc-context`) e o histórico do repositório.
- Escreva o plano em `aidlc/inception/units-of-work.md`. Para cada unidade:
  - número e nome curto;
  - objetivo em uma frase;
  - critério de aceite **medível** (número, teste ou captura de tela, nunca adjetivo);
  - a evidência que vai provar o critério;
  - o risco e o que fica de fora.
- Mostre o plano a quem aprova. A fase de Inception só fecha com `Aprovado por:` preenchido por uma pessoa, e `aidlc-phase check inception` barra a Construction enquanto isso não acontecer.

## 2. Executar

- Siga a ordem do plano. Uma unidade que descobre trabalho novo não cresce: o trabalho entra no plano como unidade nova.
- Pare no que é irreversível e não foi combinado: compra, segredo, apagar dado de usuário, mudança de licença, publicar. Traga a decisão pronta, com a recomendação.

## 3. Fechar cada unidade (todos os passos, sempre)

1. **Branch curta** `unidade-NN-<nome>` saindo da principal.
2. **Código com teste.** Mecanismo novo nasce com mutante: quebre de propósito e confirme que o teste reprova (`aidlc-mutation`).
3. **Gate verde, saída crua colada no chat:** `aidlc-gate`. Não resuma a saída.
4. **Evidência visual lida**, quando a mudança é visível: capturas abertas e examinadas à procura de defeito, não só geradas.
5. **Publicação** pelo caminho oficial do projeto, nunca por comando avulso "só desta vez".
6. **Principal atualizada.** Merge na branch principal e push.
7. **Limpeza:** `aidlc-limpeza --apagar` e a linha final colada. Ela só diz "nada sobrando" com o HEAD na principal, sem worktree ou branch de sobra. O que cair em "decidir" se resolve agora: commit e push, ou a pergunta a quem decide.
8. **Registro.** O que mudou, o que foi medido e quando, o que não foi verificado. Decisão vai para `aidlc/decisions.md`.

O `dod-check` cobra o passo 7 quando a mensagem diz que uma unidade fechou, e não aceita "unidade fechada" sem a linha do `aidlc-limpeza`.

## 4. Higiene durante o trabalho

- Container de teste com `--rm` ou com prefixo da unidade, removido na mesma unidade.
- Nunca deixe a árvore suja de um dia para o outro. Trabalho parado vai para uma branch no remoto.

## 5. O que quem aprova recebe

Por unidade, curto: o que mudou e o que foi medido (com a hora), a evidência, e o que continua sem verificação. No fim, o plano com cada unidade marcada e o próximo passo.

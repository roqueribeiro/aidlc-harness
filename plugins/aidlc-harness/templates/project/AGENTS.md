# {{NOME}}

{{DESCRICAO}}

Este projeto segue o método AI-DLC com o aidlc-harness: a IA propõe, a equipe valida, e nada é "pronto" sem evidência. As regras abaixo valem para qualquer ferramenta de IA que trabalhe aqui (Claude Code, Kiro, GitHub Copilot).

## O fluxo

1. **Inception** (`aidlc/inception/`): requisitos, histórias e unidades de trabalho. Antes de escrever código, a IA faz perguntas e a equipe responde. O resultado só vale com a aprovação registrada no próprio arquivo.
2. **Construction** (`aidlc/construction/`): desenho e plano de testes aprovados antes do código. Depois, código e testes no mesmo diff.
3. **Operations**: entrega, observação e o que foi aprendido, registrado em `aidlc/decisions.md`.

Estado das fases: `aidlc-phase status`. A fase seguinte não começa com a anterior incompleta: `aidlc-phase check inception` reprova enquanto houver campo por preencher ou aprovação em branco.

## Regras que não se negociam

- **Pergunte antes de supor.** Faltou informação, pergunte. Não invente decisão, convenção, nome ou número.
- **Pronto exige evidência.** Rode `{{COMANDO_GATE}}` e cole a saída crua no chat. Resumo da saída não vale.
- **Teste que nunca reprovou não prova nada.** Antes de declarar um check pronto, quebre o código de propósito e confirme que ele reprova.
- **Nunca enfraqueça um teste para o gate passar.** Se o teste falhou, o código está errado.
- **Segredo não aparece em tela.** Nem por echo, nem em log, nem codificado. Valor entra pelo ambiente do processo e some com ele.
- **Dependência nova: confira antes.** O pacote existe, tem dono, o nome não imita outro, está fixado no lockfile.
- **Nada de dado pessoal ou de infraestrutura no repositório.** `aidlc-identity` varre IP, e-mail, caminho de home e hostname interno.
- **Decisão fechada não se reabre.** Está em `aidlc/decisions.md` e em `context/product.md`. Discorda? Diga em uma linha e siga o que está escrito.
- **Antes de apagar, sobrescrever ou mover, liste e mostre.** Em ação irreversível, pare e peça confirmação.

## Comandos

- Gate: `{{COMANDO_GATE}}`
- Fases: `aidlc-phase status`
- Identidade: `aidlc-identity`
- Saúde do repositório: `aidlc-doctor`

## Contexto do produto

`context/product.md` diz o que o produto é, para quem, o que já foi decidido e o vocabulário do time. Leia antes de nomear algo, escrever texto para usuário ou avaliar escopo. Decisão nova que fechar na conversa vai para esse arquivo antes de a conversa acabar.

> Este arquivo é lido em toda sessão. Mantenha-o curto: invariantes aqui, detalhe em `context/` e `docs/`.

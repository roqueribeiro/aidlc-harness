# Contribuindo

*Tradução de [CONTRIBUTING.md](../../CONTRIBUTING.md), a versão principal, em inglês. Se as duas divergirem, vale a em inglês.*

Obrigado por querer melhorar o `aidlc-harness`. Este guia é curto de propósito.

## Antes de abrir um pull request

1. **Abra uma issue primeiro** para qualquer mudança além de correção pequena. Alinhar o rumo custa menos que refazer.
2. **A regra do projeto vale para o projeto:** regra sem mecanismo é decoração. Se você propõe uma norma, diga qual hook, gate ou manifesto vai executá-la.
3. **Todo check novo nasce com mutante.** Quebre o código de propósito e mostre que o teste reprova. Um teste que nunca reprovou não prova nada. Na descrição do PR, liste os mutantes que você tentou.

## Rodando localmente

Requer Node 20.19 ou mais novo e git.

```bash
node --test                          # todas as suítes
node scripts/check-plugin.mjs        # integridade do plugin
node scripts/check-quality-manifests.mjs
node scripts/check-docs-consistency.mjs
node scripts/gerar-prompts.mjs --check
node scripts/gerar-diagramas.mjs --check
node scripts/check-reference.mjs
node scripts/check-links.mjs
node plugins/aidlc-harness/tools/aidlc-identity    # nenhum dado pessoal ou de infraestrutura
```

Sem `npm install` ou `yarn install`: o kit não tem dependências de execução, de propósito.

## O que o CI confere

Identidade (`aidlc-identity`), testes, sintaxe de todo `.mjs`, manifestos contra o schema, integridade do plugin, consistência da documentação, `docs/pt-BR/PROMPTS.md` em dia e DCO nos commits.

## Regras de conteúdo

- **Nada que identifique pessoa, empresa ou infraestrutura.** Sem nomes de clientes, sistemas internos, IPs, hostnames, e-mails ou caminhos de home. O `aidlc-identity` barra os formatos; os nomes dependem de você. Se o seu exemplo precisa de um nome, use um fictício óbvio (`app-exemplo`, `fulano`).
- **Documentação em inglês, com par em português do Brasil**, direta, sem enfeite. Quem muda um documento atualiza o outro idioma no mesmo PR (inglês em `docs/`, português em `docs/pt-BR/`) e roda `node scripts/check-i18n.mjs --update` depois de rever os dois; o `check-i18n` reprova o PR que deixa um par para trás. Se você não escreve em português, diga no PR e um mantenedor completa o par. As mensagens e os prompts do kit continuam em português do Brasil.
- **Não afirme o que você não verificou.** Se algo foi testado só em Linux, diga. A seção "Limites conhecidos" do README existe para isso, e contribuições que a encolham com evidência (um teste em macOS ou Windows, por exemplo) são das mais valiosas.
- **Não copie texto de terceiros.** Cite e linke. A descrição do AI-DLC é da AWS; o `docs/pt-BR/AIDLC.md` resume e aponta para a fonte.

## DCO

Este projeto usa o [Developer Certificate of Origin](https://developercertificate.org/). Cada commit precisa de uma linha `Signed-off-by` com o seu nome e e-mail, dizendo que você tem o direito de contribuir aquele código sob a licença MIT do projeto:

```bash
git commit -s -m "fix: mensagem"
# esqueceu? refaça o último commit:
git commit --amend -s --no-edit
```

O CI reprova o pull request com commit sem assinatura.

## Estilo de commit

Mensagem curta no imperativo, com prefixo: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`. O corpo explica o porquê, não o quê.

## Reportando falha de segurança

**Não abra issue pública.** Veja [../../SECURITY.md](../../SECURITY.md).

## Conduta

Este projeto segue o [Código de Conduta](../../CODE_OF_CONDUCT.md).

---

## Resumo

Abra uma issue antes de qualquer coisa não trivial. Todo check novo vem com um mutante (quebre o código de propósito e mostre que o teste reprova). Rode `node --test` e os `scripts/check-*.mjs` antes de abrir o PR. Nada que identifique pessoa, empresa ou infraestrutura: o `aidlc-identity` precisa passar. Assine todo commit (`git commit -s`, DCO). Falha de segurança vai pelo relato privado, veja o SECURITY.md. A documentação é em inglês primeiro, com par em português em `docs/pt-BR/` que você atualiza no mesmo PR (`node scripts/check-i18n.mjs`).

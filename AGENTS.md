# aidlc-harness

O kit de qualidade para desenvolvimento com agentes de IA no ciclo AI-DLC. Este repositório se governa com o próprio kit (manifesto `harness-self`).

## Regras que não se negociam

- **Regra sem mecanismo é decoração.** Antes de propor uma norma, diga qual hook, gate ou manifesto vai executá-la.
- **Todo check novo nasce com mutante.** Quebre o código de propósito e confirme que o teste reprova. Check que nunca reprovou não é check.
- **Pronto exige evidência.** Rode `node --test` e cole a saída crua. Resumo não vale.
- **Nunca enfraqueça um teste para o gate passar.**
- **Nada que identifique pessoa, empresa ou infraestrutura.** `aidlc-identity` deve passar. Exemplos usam nomes fictícios (`app-exemplo`, `fulano`).
- **Não afirme o que não verificou.** Se só foi testado em Linux, o texto diz.
- **Antes de apagar, sobrescrever ou mover, liste e mostre.**
- **Português do Brasil, direto**, sem travessão como recurso de estilo (o `check-plugin` reprova na prosa do kit).

## Onde as coisas moram

- `plugins/aidlc-harness/`: o plugin (hooks, agentes, skills, comandos, `tools/`, `lib/`, `quality/`, `templates/`).
- `scripts/`: verificações do próprio repositório e utilitários (`setup`, `install-git-hooks`, `definir-dono`, `gerar-prompts`).
- `docs/`: documentação. `docs/PROMPTS.md` é **gerado** a partir de `commands/` e `docs/assets/diagramas/*.svg` é **gerado** por `scripts/gerar-diagramas.mjs`: não edite à mão.
- `OPERATING-MODEL.md`: o modelo operacional, com o mecanismo de cada regra.

## Comandos

- Testes: `node --test`
- Integridade do plugin: `node scripts/check-plugin.mjs`
- Manifestos: `node scripts/check-quality-manifests.mjs`
- Documentação: `node scripts/check-docs-consistency.mjs` e `node scripts/gerar-prompts.mjs --check`
- Diagramas, referência e links: `node scripts/gerar-diagramas.mjs --check`, `node scripts/check-reference.mjs` e `node scripts/check-links.mjs`
- Documentação em inglês (`docs/en/`, `README.en.md`): `node scripts/check-i18n.mjs`. Mudou um documento em português, atualize o par e rode `--atualizar` depois de rever
- Identidade: `node plugins/aidlc-harness/tools/aidlc-identity`
- Validação oficial do plugin: `claude plugin validate ./plugins/aidlc-harness --strict`

Veja `CONTRIBUTING.md` para o fluxo completo.

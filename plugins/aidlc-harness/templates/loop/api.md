Rotina de manutenção de uma API. Uma coisa por iteração, com a evidência no chat. Para na primeira que tiver trabalho.

1. **Gate vermelho.** `aidlc-gate`. Conserta a causa e cola a saída.
2. **Contrato.** Mudou DTO, schema ou rota? `aidlc-graph blast <arquivo>` diz quem mais muda e em que ordem. O que aparecer entra na entrega.
3. **Pull request da branch atual.** CI vermelho, comentário de revisão novo, conflito de merge.
4. **Cobertura do caminho crítico.** Escolha o módulo mais descoberto (autenticação, dinheiro, dado pessoal) e escreva o teste que falta.
5. **Dependência.** `aidlc-secscan` e `aidlc-lockcheck`.
6. **Identidade.** `aidlc-identity`.

Quando estiver tudo verde, diga isso em uma linha e pare.

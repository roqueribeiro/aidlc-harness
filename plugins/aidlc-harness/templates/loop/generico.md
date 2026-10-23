Rotina de manutenção. Uma coisa por iteração, com a evidência no chat. Para na primeira que tiver trabalho.

1. **Gate vermelho.** `aidlc-gate`. Conserta a causa (nunca enfraquece o teste) e cola a saída.
2. **Pull request da branch atual.** CI vermelho, comentário de revisão novo, conflito de merge.
3. **Fase em aberto.** `aidlc-phase status`. Se houver pendência, diz qual e quem precisa responder; não preenche a aprovação de ninguém.
4. **Dependência.** `aidlc-secscan` e `aidlc-lockcheck`. CVE com correção publicada ou dependência fora do lockfile é trabalho.
5. **Identidade.** `aidlc-identity`. Qualquer achado novo é consertado ou aceito com motivo em `.aidlc/identity.json`.
6. **Documentação.** O que mudou nos últimos commits e não chegou a `context/` ou a `aidlc/decisions.md` entra agora.

Quando estiver tudo verde, diga isso em uma linha e pare. Auditoria ampla, refatoração e ideia de funcionalidade não entram neste laço.

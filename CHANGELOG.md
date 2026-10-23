# Changelog

Formato [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento semântico a partir da 1.0; na série 0.x, qualquer versão pode mudar o comportamento.

## [0.1.0] - não lançado

Primeira versão pública do kit.

### Incluído

- Plugin `aidlc-harness` para Claude Code: 8 hooks, 3 agentes, 4 skills, 4 comandos (`/inception`, `/construction`, `/gate`, `/status`) e 14 executáveis `aidlc-*`.
- Fases do AI-DLC como artefatos conferidos: `aidlc-init` (esqueleto e instruções para Claude Code, Kiro e Copilot a partir de um `AGENTS.md`) e `aidlc-phase` (Inception e Construction, aprovação humana obrigatória).
- Critério de aceite como dado: manifestos `node-yarn`, `node-npm`, `python-uv` e `harness-self`, e manifestos do próprio projeto em `.aidlc/quality/`.
- `aidlc-identity`: scanner de IP, MAC, e-mail, caminho de home, hostname interno, segredo e termos proibidos mantidos fora do repositório.
- `scripts/setup.mjs` (executáveis no PATH, macOS, Linux e Windows), `scripts/install-git-hooks.mjs`, `scripts/definir-dono.mjs`, `scripts/gerar-prompts.mjs`.
- `aidlc-scan`: lê o relatório de qualquer plataforma de segurança (SARIF 2.1.0, formato neutro, AI Fix Bundle do RoqueShield) e separa limpo (0), reprovado (1) e não rodou (2). Modelo de gate em `templates/security/`.
- `aidlc-gate` coloca a pasta dos executáveis do kit na frente do `PATH` dos comandos dos gates: sem isso, um gate `aidlc-scan` ou `aidlc-lockcheck` dava `command not found` em runner de CI limpo.
- `aidlc-identity`: a allowlist aceita `valor`, para liberar um termo só, não a categoria inteira no arquivo.
- Documentação: trilha guiada, interpretação do AI-DLC, adaptadores, perfil para organizações reguladas, e a documentação de referência (`docs/INDEX.md`, `ARQUITETURA`, `REFERENCIA`, `INTEGRACOES`, `ROQUESHIELD`, `GLOSSARIO`) com 10 diagramas e a marca, gerados do código (claro e escuro), conferidos no CI, mais relatórios de exemplo executados pelos testes.
- Checks novos, cada um com mutantes: `gerar-diagramas --check` (SVG acompanha o código), `check-reference` (a referência cobre o que existe e a prosa não cita comando fantasma) e `check-links` (todo link relativo resolve, inclusive âncora).

### Limites

Testado em Linux com Node 22. macOS, Windows, Kiro e GitHub Copilot não foram testados em máquina real.

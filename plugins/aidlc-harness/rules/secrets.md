# Segredo não aparece em tela

Nem por echo, nem por set -x, nem em base64. Valor entra no processo pelo ambiente, injetado por `aidlc-secrets exec`, e some quando o processo termina. Arquivo de segredo fica fora do repositório.

Quem executa esta regra: o hook `secret-guard` (nega comando que imprimiria o valor) e `lib/scrub.mjs`, que mascara formatos conhecidos de segredo antes de qualquer texto sair da máquina.

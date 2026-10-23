# Dependência: existe, tem dono, está fixada

Dependência nova entra com o lockfile regenerado no mesmo diff. Antes do merge, confira no registry: o nome é parecido com o de outro pacote conhecido? Quanto tempo tem, quem publica, há script de instalação? Código gerado por IA cita pacote que não existe, e quem registra o nome antes passa a controlar o seu build.

Quem executa esta regra: o gate `lockfile` (camada `_org.json`, `aidlc-lockcheck`), o gate `secscan` (CVE com correção publicada) e o revisor `supply-chain-reviewer`, cobrado como evidência no Stop quando package.json ou o lockfile mudam.

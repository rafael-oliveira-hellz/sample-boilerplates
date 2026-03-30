# ADR 0001 - Baseline de arquitetura da API Mongo CRUD

- Status: Aceita
- Data: 2026-03-29

## Contexto

O projeto precisava nascer como uma API CRUD simples, mas com baseline suficiente para uso corporativo:

- MongoDB com TLS e certificado
- separacao de leitura e escrita
- rastreabilidade para Datadog
- validacao forte de entrada
- seguranca HTTP basica
- cache para leituras quentes
- estrutura reutilizavel para novos contextos de negocio

Ao mesmo tempo, a solucao nao deveria "bazucar" o projeto com stack reativa, frameworks extras ou abstracoes desnecessarias para um primeiro modulo.

## Decisao

Foi adotado o seguinte baseline arquitetural:

1. Spring Boot 4.0.1 com Spring MVC sincrono e virtual threads habilitadas.
2. MongoDB acessado por dois clientes/templates:
   - escrita com `ReadPreference.primary()`
   - leitura com `ReadPreference.secondaryPreferred()`
3. TLS com `PKCS12` carregado por fabrica dedicada de `SSLContext`.
4. `UUID` como identificador de negocio gerado na aplicacao, com `UuidRepresentation.STANDARD` configurado explicitamente.
5. Contrato HTTP em ingles e campos persistidos em portugues no Mongo.
6. Cache via anotacoes Spring + Caffeine, com politica conservadora para listagem.
7. Erros HTTP centralizados e padronizados em um `RestControllerAdvice`.
8. Logging HTTP estruturado com correlacao de `traceId` e `spanId`.
9. API stateless com CORS por allowlist e headers de seguranca, preparada para conviver com autenticacao corporativa externa.
10. Rate limit local por instancia como protecao inicial de burst.

## Consequencias Positivas

- Baseline simples de entender e de evoluir.
- Boa compatibilidade com CRUDs adicionais.
- Separacao clara entre preocupacoes transversais e dominio.
- Melhor controle operacional em ambientes com replica set.
- Maior robustez para credenciais com caracteres especiais ao usar `MongoCredential` em vez de URI montada manualmente.
- Melhor suporte a troubleshooting com logs estruturados e correlacao de tracing.

## Consequencias Negativas

- O rate limit atual nao e distribuido.
- O stack continua bloqueante no acesso ao Mongo.
- O OpenAPI precisa ser mantido manualmente.
- O cache de lista usa invalidacao ampla (`allEntries = true`) para manter simplicidade.

## Alternativas Consideradas

### 1. Spring WebFlux + driver reativo

Rejeitada neste momento por aumentar a complexidade sem necessidade comprovada para o escopo inicial.

### 2. Usar apenas uma conexao Mongo para tudo

Rejeitada para preservar semantica de leitura/escrita e preparar o baseline para replica set.

### 3. Expor `_id` nativo do Mongo

Rejeitada porque acopla o contrato externo ao mecanismo de persistencia.

### 4. Montar URI Mongo manualmente com encode de credenciais

Rejeitada em favor de `MongoCredential`, que e mais robusto para caracteres especiais e menos fragil a erros de encoding.

### 5. Adicionar circuit breaker no baseline

Rejeitada por ora. Para CRUD direto em Mongo, timeouts, tratamento adequado de `503`, observabilidade e rate limit trazem um baseline melhor antes de introduzir comportamento de abertura de circuito.

## Proximos Passos Naturais

Quando o projeto crescer, os proximos passos arquiteturais mais provaveis sao:

- mover rate limit para camada distribuida
- adicionar metricas de pool e operacao Mongo
- revisar indices por contexto de negocio real
- avaliar extracao de bibliotecas internas para capacidades transversais comuns
- definir estrategia padrao de testes automatizados por contexto


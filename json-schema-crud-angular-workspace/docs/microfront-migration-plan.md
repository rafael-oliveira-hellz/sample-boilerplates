# Plano de Migração para Micro Frontends

## Objetivo

Usar o sistema de mapeamento JSON como piloto da base corporativa de microfrontends da Porto Seguro, mantendo o fluxo atual estável e preparando uma fundação reutilizável para outros produtos.

## Resumo executivo

Este sistema é um bom candidato para iniciar a plataforma corporativa porque:

- é um produto real, não um exemplo artificial
- possui estado relevante, integração com backend, importação, edição, preview e persistência
- estressa autenticação, layout, observabilidade e composição

O corte recomendado é:

- `host-shell` corporativo
- este sistema inteiro como `mfe-json-mapper`
- extrações adicionais só quando houver reuso claro

## Arquitetura alvo corporativa

### Apps

```text
apps/
  host-shell/
  mfe-json-mapper/
  mfe-policy/
  mfe-claims/
  mfe-billing/
  mfe-admin/
```

### Libs

```text
libs/
  shared/
    contracts/
    design-system/
    auth/
    observability/
    runtime/
    util/
```

### Princípios

- Shell cuida de layout, auth, observabilidade, feature flags e roteamento
- Cada remote representa um domínio de negócio
- Comunicação por contratos tipados e eventos de negócio
- Shared contém apenas o que é transversal e estável

## Como este projeto entra na plataforma

### Papel do projeto

- remote inicial da plataforma
- nome sugerido: `mfe-json-mapper`
- rota sugerida: `/integracoes/json-mapper`

### O que fica no shell

- autenticação
- autorização
- layout corporativo
- menu
- breadcrumbs
- notificações globais
- observabilidade
- contexto transversal

### O que fica no remote

- dados de entrada
- estrutura de saída
- refino do campo
- regras visuais
- preview
- importação/exportação
- persistência da configuração

## Estrutura interna recomendada para remotes

```text
mfe-json-mapper/
  features/
    source/
      domain/
      application/
      infra/
      ui/
    target/
      domain/
      application/
      infra/
      ui/
    workbench/
      domain/
      application/
      infra/
      ui/
    rules/
      domain/
      application/
      infra/
      ui/
    preview/
      domain/
      application/
      infra/
      ui/
```

## Padrão de comunicação

### O shell entrega ao remote

- sessão
- tenant
- roles
- tema
- feature flags
- endpoints base

### O remote emite

- `MAPPER/LOADED`
- `MAPPER/SAVE_STARTED`
- `MAPPER/SAVE_SUCCEEDED`
- `MAPPER/SAVE_FAILED`
- `MAPPER/LOAD_LATEST_SUCCEEDED`
- `MAPPER/PREVIEW_OPENED`

## Ferramentas recomendadas

- Angular moderno
- Shell + Remotes
- Native Federation ou Module Federation
- Monorepo com Nx
- boundaries rígidas
- contratos fortemente tipados

## Qualidade e gates obrigatórios

Cada fase da migração deve preservar o fluxo de qualidade.

Gates mínimos por app ou remote:

- testes unitários
- testes de integração por feature crítica
- e2e do fluxo principal
- smoke test de bootstrap do shell e do remote
- build de produção
- regressão automatizada para todo bug corrigido

Gates adicionais quando houver integração externa ou contrato público:

- validação runtime de payloads
- contract tests para shell <-> remote
- telemetria mínima para erros de bootstrap e falhas de montagem

## Plano de migração completo

### Fase 0 — Fundação da plataforma

Objetivo:

- criar a base corporativa de microfrontends

Entregas:

- `host-shell`
- `shared/contracts`
- `shared/design-system`
- `shared/auth`
- `shared/observability`
- `shared/runtime`
- convenções de CI/CD
- convenções de naming
- convenções de eventos
- convenções de ownership
- convenções de qualidade e gates

### Fase 1 — Modularização interna do mapeador

Objetivo:

- preparar este projeto para virar remote sem acoplamento desnecessário

Entregas:

- reorganização por features
- separação de responsabilidades
- boundaries internas claras
- redução de imports cruzados
- cobertura regressiva dos fluxos críticos

### Fase 2 — Extração para remote único

Objetivo:

- transformar este app atual em `mfe-json-mapper`

Entregas:

- build standalone do remote
- carregamento dentro do `host-shell`
- mesmo comportamento funcional atual
- telemetria mínima conectada
- smoke test de mount/unmount

### Fase 3 — Contratos corporativos

Objetivo:

- consolidar interfaces públicas

Entregas:

- contratos de sessão
- contratos de navegação
- contratos de eventos
- DTOs externos tipados
- validação runtime nas bordas
- contract tests

### Fase 4 — Operação e governança

Objetivo:

- tornar o padrão sustentável para vários produtos

Entregas:

- pipeline por remote
- versionamento de contratos
- rollback controlado
- catálogo de microfronts
- documentação de onboarding
- quality gates padronizados

### Fase 5 — Expansão para outros domínios

Objetivo:

- replicar a plataforma para outros produtos

Candidatos:

- policy
- claims
- billing
- admin

## Riscos principais

- quebrar o corte de domínio cedo demais
- shared virar framework corporativo monolítico
- shell assumir regra de negócio
- contratos mudarem sem compatibilidade
- mais de um padrão arquitetural coexistir sem governança

## Critérios de sucesso

- este sistema roda standalone e no host
- shell fornece contexto transversal, não negócio
- remotes permanecem autônomos
- contratos ficam pequenos e estáveis
- um segundo produto entra na base sem reinvenção
- quality gates são executados automaticamente no pipeline

## Próximo passo recomendado

Executar um spike com:

- `host-shell`
- `mfe-json-mapper`
- `shared/contracts`
- `shared/design-system`
- uma rota real integrada
- auth fake inicial
- telemetria fake inicial
- smoke test de montagem do remote

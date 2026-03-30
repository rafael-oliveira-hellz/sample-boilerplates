# AGENTS.frontend.md

## Objetivo

Definir os padrões de frontend para a plataforma corporativa de microfrontends em Angular, com foco em:

- Shell + Remotes
- domínio antes de camada técnica
- tipagem forte
- SCSS previsível e sustentável
- UX consistente
- qualidade automatizada de ponta a ponta

## Stack recomendada

- Angular moderno
- Shell/Host + Remotes
- Native Federation ou Module Federation
- Monorepo com Nx ou estrutura equivalente com boundaries rígidas
- TypeScript estrito
- Signals, facades por feature e contratos tipados

## Padrão de corte arquitetural

### Correto

- `mfe-policy`
- `mfe-claims`
- `mfe-billing`
- `mfe-admin`
- `mfe-json-mapper`

### Incorreto

- `mfe-button`
- `mfe-sidebar`
- `mfe-form`
- `mfe-inspector`

Microfront é fronteira de negócio, não widget.

## Estrutura interna de cada remote

Preferir vertical slice com DDD leve:

```text
mfe-policy/
  features/
    issue-policy/
      domain/
      application/
      infra/
      ui/
    policy-details/
      domain/
      application/
      infra/
      ui/
```

### Responsabilidades

- `domain`
  - entidades
  - value objects
  - regras puras
  - contratos internos

- `application`
  - facades
  - casos de uso
  - orchestration
  - view models

- `infra`
  - api clients
  - adapters
  - mappers
  - gateways

- `ui`
  - components
  - pages
  - presentational logic

## Padrões recomendados

### Facade

Uma facade por feature ou fluxo principal.

- UI não conversa direto com HTTP.
- UI não espalha regra de negócio.
- UI consome state + commands da facade.

### Adapter

Obrigatório em payload legado, backends estranhos ou contratos externos instáveis.

### Anti-Corruption Layer

Usar na borda com APIs legadas e integração entre contextos distintos.

### Strategy

Usar para variação por parceiro, tenant, canal ou produto.

### Ports and Adapters

Aplicar de forma leve, especialmente em fluxos críticos.

## Tipagem forte

- `strict` sempre ligado.
- Proibir `any` sem justificativa.
- Tipos de contratos externos devem ser explícitos.
- Validar payload externo em runtime.

Ferramentas recomendadas para runtime validation:

- `zod`
- `valibot`

## Shell

O shell deve conter:

- layout
- autenticação
- autorização
- navegação
- feature flags
- observabilidade
- contexto global
- composição dos remotes

O shell não deve conter:

- regra de negócio dos produtos
- stores de domínio
- lógica específica de tela de um remote

## Comunicação entre remotes

### Permitido

- contratos públicos tipados
- eventos de negócio
- mediação pelo shell

### Proibido

- import direto entre remotes
- acesso a service interno de outro remote
- store global compartilhado com regras de vários domínios

## Estado

### Global no shell

- sessão
- tenant
- idioma
- tema
- feature flags

### Local no remote

- filtros
- wizard state
- entidades do domínio
- cache do fluxo
- seleção e edição de tela

## SCSS e styling

### Diretrizes gerais

- Usar design tokens e CSS custom properties para cor, spacing, radius, shadow e typography.
- Evitar valores mágicos repetidos.
- Extrair patterns visuais estáveis para o design system.
- Manter estilos por responsabilidade visual, não por gambiarra de seletor.

### Organização

- `shared/design-system`: tokens, mixins leves, componentes base
- estilos locais apenas para composição da feature
- evitar sobreposições globais agressivas

### Convenções

- classes previsíveis e sem acoplamento desnecessário ao HTML
- evitar seletores profundos e frágeis
- evitar `!important`
- evitar estilos dependentes de ordem incidental do DOM

### Preferências

- `flex` e `grid` primeiro
- `min-height: 0` e `overflow` corretos em layouts roláveis
- foco visível e acessibilidade por padrão
- hover, active e disabled consistentes

### Não fazer

- bordas pesadas sem motivo
- variações visuais sem token
- componentes “super configuráveis” que viram framework interno

## UI compartilhada

Compartilhar:

- tokens
- tipografia
- cores
- spacing
- botões base
- campos base
- modal
- tabs
- toasts
- badges

Não compartilhar cedo:

- componentes de negócio
- telas semi-prontas
- grids universais
- formulários genéricos demais

## DRY correto

Compartilhar:

- contratos
- componentes base
- helpers pequenos
- abstrações estáveis

Não compartilhar cedo:

- facades genéricas
- services cross-domínio
- stores globais
- regra de negócio disfarçada de utilitário

## Versionamento

- contratos compartilhados com compatibilidade retroativa sempre que possível
- campos novos opcionais por padrão
- evitar breaking change frequente
- feature flag para rollout quando necessário

## Testing e qualidade

- testes unitários em facades, adapters, mappers, rules engines e utilitários puros
- testes de integração por feature ou fluxo crítico
- e2e nos fluxos principais do domínio
- testes regressivos automatizados sempre que houver correção de bug
- smoke tests de bootstrap do shell e dos remotes
- build de produção como gate obrigatório
- quando o risco justificar, incluir contract tests para shell <-> remote e validação runtime nas bordas

## Checklist de qualidade para novos remotes

- domínio claro
- ownership definido
- contratos tipados
- runtime validation nas bordas
- facade por fluxo
- boundaries respeitadas
- sem import cruzado entre remotes
- shell sem regra de negócio
- tokens visuais corporativos aplicados
- suíte mínima com unit, integração, e2e e smoke bootstrap
- cobertura regressiva dos fluxos mais críticos do domínio

## Performance

- lazy loading por remote e por áreas pesadas
- shared pequeno e estável
- evitar dependências globais desnecessárias
- preferir composição clara a meta-framework interno

## Regra de ouro

Domínio claro, contratos pequenos, shell simples, remote autônomo.

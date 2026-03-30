# AGENTS.md

## Propósito

Este documento define os princípios globais de arquitetura, organização, colaboração e qualidade para a evolução dos frontends da empresa, com foco em uma plataforma corporativa de microfrontends.

Ele deve ser lido em conjunto com [AGENTS.frontend.md](E:\017-crud-json-schema-entrada-e-saida\AGENTS.frontend.md).

## Princípios de arquitetura

- Preferir microfront por domínio de negócio, nunca por componente visual isolado.
- O shell compõe, autentica, observa e roteia. A regra de negócio mora no remote.
- Domínios se comunicam por contratos tipados e eventos de alto nível, não por import direto entre remotes.
- Reuso só entra em `shared` quando houver estabilidade e evidência real de reaproveitamento.
- Um pouco de duplicação local é melhor do que um acoplamento central ruim.

## Princípios de design de sistema

- `KISS`: a solução mais simples que preserve clareza, evolução e segurança.
- `DRY`: compartilhar contratos, tokens, componentes base e utilitários estáveis; não compartilhar comportamento de negócio cedo demais.
- `SOLID` aplicado de forma pragmática:
  - `S`: um remote por responsabilidade de negócio clara
  - `O`: extensões por strategy, providers e configuração tipada
  - `L`: contratos pequenos e previsíveis
  - `I`: interfaces específicas por caso de uso
  - `D`: domínio depende de abstrações, infra implementa ports

## Fronteiras permitidas

- `host-shell` pode depender apenas de libs `shared/*` e contratos públicos dos remotes.
- `remotes` não podem importar código de outros remotes.
- `shared/*` não pode conhecer regras de negócio de um domínio específico.
- `domain/*` não pode depender de `ui/*`.
- `application/*` orquestra caso de uso; `infra/*` fala com API; `ui/*` renderiza e interage com facade.

## Organização recomendada

```text
apps/
  host-shell/
  mfe-policy/
  mfe-claims/
  mfe-json-mapper/

libs/
  policy/
    domain/
    application/
    ui/
  claims/
    domain/
    application/
    ui/
  shared/
    contracts/
    design-system/
    auth/
    observability/
    runtime/
    util/
```

## Contratos e integração

- Todo contrato entre shell e remote deve ser tratado como API pública.
- Tipagem forte é obrigatória nas bordas.
- Sempre validar payload externo em runtime.
- Não usar classes concretas como contrato entre domínios; preferir interfaces, DTOs e tipos versionados.

## Eventos e comunicação

- Preferir shell-mediated communication ou event bus leve e tipado.
- Eventos devem representar fatos de negócio, não detalhes de implementação.
- Evitar stores globais compartilhadas entre remotes.

## Estado

- Estado global mínimo:
  - sessão
  - tenant
  - idioma
  - tema
  - feature flags
- Estado de negócio e de tela deve ficar no remote.

## Shared

Pode entrar em `shared`:

- contratos
- design tokens
- componentes básicos estáveis
- auth abstractions
- observability
- helpers pequenos

Não pode entrar cedo em `shared`:

- facades genéricas demais
- stores globais gigantes
- services cheios de regra de negócio
- smart components acoplados a domínio

## Padrão de evolução

1. Modelar o domínio.
2. Definir contratos públicos.
3. Implementar vertical slice.
4. Extrair shared apenas se houver reuso comprovado.
5. Medir impacto em dependências e ownership.

## Governança

- Cada remote deve ter ownership explícito.
- Cada lib shared deve ter maintainer definido.
- Breaking change em contratos exige versionamento e plano de compatibilidade.
- O shell deve continuar “burro”: composição, contexto transversal e observabilidade.

## Qualidade e testes

- Todo fluxo crítico deve ter cobertura automatizada de regressão.
- O padrão mínimo de qualidade inclui:
  - testes unitários para regras puras, facades, adapters, mappers e utilitários
  - testes de integração por feature ou bounded context
  - testes end-to-end nos fluxos críticos de negócio
  - smoke tests de bootstrap do shell e dos remotes
- Não é aceitável evoluir shell, contratos compartilhados ou remotes sem algum nível de validação automatizada compatível com o risco da mudança.
- Regressões reportadas em produção devem gerar teste automatizado antes ou junto da correção.
- Contratos entre shell e remotes precisam de validação em compile-time e em runtime nas bordas externas.
- Qualquer novo remote precisa entrar com pipeline que execute, no mínimo:
  - lint ou validação equivalente de arquitetura
  - testes unitários
  - testes de integração relevantes
  - e2e do fluxo principal
  - build de produção

## Anti-patterns proibidos

- microfront por componente
- import cruzado entre remotes
- regra de negócio no shell
- shared lib que mistura vários domínios
- abstração prematura
- múltiplos padrões arquiteturais conflitantes no mesmo ecossistema

## Regra de ouro

Baixo acoplamento, fronteira explícita, contrato tipado e ownership por domínio.

# microfront-react

Base em React para o ecossistema de microfrontends, com o `json-mapper` já operando nativamente no fluxo principal.

## Estrutura

- `apps/host-shell`: host corporativo React
- `apps/mfe-json-mapper`: remote do domínio de mapeamento JSON
- `packages/shared-contracts`: contratos tipados entre shell e remotes
- `packages/shared-runtime`: contexto transversal do shell em React
- `packages/shared-design-system`: tokens e CSS base Porto

## Comandos

```bash
npm install
npm run dev:mfe
npm run dev:host
npm run build
npm run test
```

## Portas

- host: `http://localhost:4100`
- remote json mapper: `http://localhost:4101`

## Direção arquitetural

- shell simples, remote por domínio
- contratos tipados como API pública
- shared pequeno e estável
- vertical slice dentro do remote
- fluxo principal do `json-mapper` rodando em React

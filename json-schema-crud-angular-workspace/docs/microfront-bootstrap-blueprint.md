# Blueprint Inicial do Shell e dos Remotes

## Objetivo

Definir o esqueleto inicial da plataforma para sair do app único atual e entrar em um modelo corporativo reutilizável.

## Estrutura sugerida

```text
apps/
  host-shell/
    apps/mfe-json-mapper/src/app/
      core/
      layout/
      routes/
      shell/
  mfe-json-mapper/
    apps/mfe-json-mapper/src/app/
      bootstrap/
      features/
        source/
        target/
        workbench/
        rules/
        preview/

libs/
  shared/
    contracts/
    design-system/
    auth/
    observability/
    runtime/
    util/
```

## Responsabilidades iniciais

### host-shell

- bootstrap da plataforma
- guarda de autenticação
- container visual
- navegação
- registro de remotes
- telemetria global

### mfe-json-mapper

- domínio de mapeamento JSON
- edição de origem
- edição de destino
- refino do campo
- regras visuais
- preview
- salvar/carregar configuração

## Contratos mínimos

### libs/shared/contracts

```ts
export interface UserSession {
  userId: string;
  tenantId: string;
  roles: readonly string[];
}

export interface ShellContext {
  session: UserSession;
  locale: string;
  theme: 'porto-light' | 'porto-dark';
  featureFlags: Readonly<Record<string, boolean>>;
  apiBaseUrl: string;
}

export type AppEvent =
  | { type: 'AUTH/SESSION_UPDATED'; payload: UserSession }
  | { type: 'MAPPER/SAVED'; payload: { configId: string } }
  | { type: 'MAPPER/LOAD_LATEST_SUCCEEDED'; payload: { configId: string } };
```

## API pública do remote

Exemplo conceitual:

```ts
export interface RemoteMountOptions {
  hostElement: HTMLElement;
  context: ShellContext;
  onEvent(event: AppEvent): void;
}

export interface RemoteModule {
  mount(options: RemoteMountOptions): Promise<void>;
  unmount(): Promise<void>;
}
```

## Sequência sugerida de implementação

1. Criar o `host-shell`
2. Criar `shared/contracts`
3. Criar `shared/design-system`
4. Transformar este app em `mfe-json-mapper`
5. Integrar rota `/integracoes/json-mapper`
6. Substituir contexto local por `ShellContext`
7. Instrumentar eventos de save/load

## Regras de implementação

- sem import cruzado entre remotes
- sem regra de negócio no shell
- sem shared de domínio
- sem store global para fluxos locais
- façade por feature crítica

## Critério para próxima extração

Só extrair novo remote quando houver:

- domínio próprio
- owner próprio
- roadmap próprio
- autonomia de deploy desejada


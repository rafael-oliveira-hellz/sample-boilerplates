import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import '@porto/shared-design-system/porto.css';
import './styles.css';
import {
  Badge,
  LayoutStack,
  SegmentedTabs,
  StatChip,
  SurfaceCard
} from '@porto/shared-design-system';
import {
  DEFAULT_SHELL_CONTEXT,
  type AppEvent,
  type JsonMapperWidgetProps,
  type RemoteModule,
  type ShellContext
} from '@porto/shared-contracts';
import { AppEventBus } from './core/appEventBus';
import { loadJsonMapperRemote } from './core/loadRemoteEntry';
import { loadJsonMapperWidget } from './core/loadJsonMapperWidget';

const shellContext: ShellContext = {
  ...DEFAULT_SHELL_CONTEXT,
  appName: 'host-shell-react'
};

export function App(): JSX.Element {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'mounted' | 'error'>('idle');
  const [events, setEvents] = useState<readonly AppEvent[]>([]);
  const [activeShellMode, setActiveShellMode] = useState<'showcase' | 'operations'>('showcase');
  const [WidgetComponent, setWidgetComponent] = useState<ComponentType<JsonMapperWidgetProps> | null>(null);
  const eventBus = useMemo(() => new AppEventBus(), []);

  useEffect(() => eventBus.subscribe(setEvents), [eventBus]);

  useEffect(() => {
    let remoteModule: RemoteModule | null = null;
    let cancelled = false;

    async function mountRemote(): Promise<void> {
      if (!hostRef.current) {
        return;
      }

      setStatus('loading');

      try {
        remoteModule = await loadJsonMapperRemote();

        if (cancelled || !hostRef.current) {
          return;
        }

        await remoteModule.mount({
          hostElement: hostRef.current,
          context: shellContext,
          onEvent: (event) => eventBus.publish(event)
        });

        if (!cancelled) {
          setStatus('mounted');
        }
      } catch (error) {
        console.error('Falha ao montar o remote React.', error);
        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    async function loadOptionalWidget(): Promise<void> {
      try {
        const loadedWidget = await loadJsonMapperWidget();
        if (!cancelled) {
          setWidgetComponent(() => loadedWidget);
        }
      } catch (error) {
        console.warn('Falha ao carregar o widget público do mapper. O remote completo segue operacional.', error);
      }
    }

    void mountRemote();
    void loadOptionalWidget();

    return () => {
      cancelled = true;
      void remoteModule?.unmount();
    };
  }, [eventBus]);

  return (
    <main className="shell-layout">
      <SurfaceCard
        kicker="HOST SHELL"
        title="Plataforma corporativa de microfrontends em React"
        description="Shell transversal para a Porto Seguro, com composição de remotes por domínio, contexto tipado e fronteiras explícitas."
        className="shell-hero"
        aside={
          <div className={`hero-status state-${status}`}>
            <strong>
              {status === 'mounted'
                ? 'Remote montado'
                : status === 'loading'
                  ? 'Carregando remote'
                  : status === 'error'
                    ? 'Falha ao montar'
                    : 'Aguardando'}
            </strong>
            <span>json-mapper / domínio operacional</span>
          </div>
        }
      />

      <SurfaceCard
        kicker="REUSO SAUDÁVEL"
        title="Três formas de consumo"
        description="Exemplo explícito de quando usar design system, widget público ou o remote inteiro."
        className="shell-patterns-card"
        aside={
          <SegmentedTabs
            value={activeShellMode}
            onChange={setActiveShellMode}
            options={[
              { value: 'showcase', label: 'Showcase' },
              { value: 'operations', label: 'Operação' }
            ]}
          />
        }
      >
        <div className="shell-patterns-grid">
          <div className="shell-pattern-card">
            <Badge tone="info">Design System</Badge>
            <h3>Visual genérico</h3>
            <p>Cards, pills, tabs, headers, badges e blocos de layout ficam em pacote compartilhado e estável.</p>
            <div className="shell-pattern-stats">
              <StatChip value="5" label="primitives" />
              <StatChip value="0" label="regra de negócio" />
            </div>
          </div>

          <div className="shell-pattern-card">
            <Badge tone="success">Widget público</Badge>
            <h3>Feature estável menor</h3>
            <p>Resumo público do mapper para outros apps consumirem sem puxar o domínio inteiro.</p>
            {WidgetComponent ? (
              <WidgetComponent
                partnerName="porto_teste_1"
                eventName="emissão"
                version="v1"
                mappedFields={12}
                status="ready"
                onOpen={() => setActiveShellMode('operations')}
              />
            ) : (
              <p>Carregando widget público...</p>
            )}
          </div>

          <div className="shell-pattern-card">
            <Badge>Remote completo</Badge>
            <h3>Domínio inteiro</h3>
            <p>Quando o outro produto precisa do JSON Mapper completo, ele consome o remote inteiro em uma rota ou área própria.</p>
            <div className="shell-pattern-stats">
              <StatChip value={status === 'mounted' ? 'OK' : '...' } label="federado" />
              <StatChip value="bounded context" label="ownership" />
            </div>
          </div>
        </div>
      </SurfaceCard>

      <section className="shell-grid">
        <aside className="shell-sidebar">
          <SurfaceCard kicker="CONTEXTO" title="Shell global" className="shell-panel">
            <dl className="shell-definition-list">
              <div><dt>Usuário</dt><dd>{shellContext.session.userId}</dd></div>
              <div><dt>Tenant</dt><dd>{shellContext.session.tenantId}</dd></div>
              <div><dt>Tema</dt><dd>{shellContext.theme}</dd></div>
              <div><dt>API</dt><dd>{shellContext.apiBaseUrl}</dd></div>
            </dl>
          </SurfaceCard>

          <SurfaceCard kicker="REMOTE" title="mfe-json-mapper-react" className="shell-panel">
            <p>Primeiro domínio da plataforma, já operando como remote React principal dentro do host corporativo.</p>
          </SurfaceCard>

          <SurfaceCard kicker="EVENTOS" title="Eventos recentes" className="shell-panel">
            <ul className="event-list">
              {events.length === 0 ? <li>Nenhum evento emitido ainda.</li> : null}
              {events.map((event, index) => (
                <li key={`${event.type}-${index}`}>
                  <strong>{event.type}</strong>
                </li>
              ))}
            </ul>
          </SurfaceCard>
        </aside>

        <SurfaceCard
          kicker="DOMÍNIO"
          title="JSON Mapper"
          description="O host permanece burro: compõe, injeta contexto transversal e observa os eventos emitidos pelo remote."
          className="shell-panel shell-remote"
        >
          <div ref={hostRef} className="remote-host" />
        </SurfaceCard>
      </section>
    </main>
  );
}

export default App;

import { Badge, LayoutStack, StatChip, SurfaceCard } from '@porto/shared-design-system';
import type { JsonMapperWidgetProps } from '@porto/shared-contracts';

export function JsonMapperSummaryWidget({
  partnerName,
  eventName,
  version,
  mappedFields,
  status,
  onOpen
}: JsonMapperWidgetProps): JSX.Element {
  const statusLabel =
    status === 'ready' ? 'Pronto para operação' : status === 'attention' ? 'Requer atenção' : 'Em montagem';
  const tone = status === 'ready' ? 'success' : status === 'attention' ? 'info' : 'default';

  return (
    <SurfaceCard
      kicker="WIDGET PÚBLICO"
      title="Resumo do JSON Mapper"
      description="Feature menor e estável para outros apps consumirem sem importar internals do remote."
      aside={<Badge tone={tone}>{statusLabel}</Badge>}
      className="mapper-widget-card"
    >
      <LayoutStack className="mapper-widget-body">
        <div className="mapper-widget-meta">
          <Badge>{partnerName}</Badge>
          <Badge>{eventName}</Badge>
          <Badge>{version}</Badge>
        </div>

        <div className="mapper-widget-stats">
          <StatChip value={mappedFields} label="campos mapeados" />
        </div>

        <button type="button" onClick={onOpen}>
          Abrir mapper completo
        </button>
      </LayoutStack>
    </SurfaceCard>
  );
}

export default JsonMapperSummaryWidget;

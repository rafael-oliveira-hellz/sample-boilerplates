declare module 'json_mapper_remote/remote-entry' {
  import type { RemoteModule } from '@porto/shared-contracts';

  export const jsonMapperRemote: RemoteModule;
  export default jsonMapperRemote;
}

declare module 'json_mapper_remote/json-mapper-widget' {
  import type { ComponentType } from 'react';
  import type { JsonMapperWidgetProps } from '@porto/shared-contracts';

  export const JsonMapperSummaryWidget: ComponentType<JsonMapperWidgetProps>;
  export default JsonMapperSummaryWidget;
}

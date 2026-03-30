export interface RemoteDefinition {
  domain: string;
  routePath: string;
  remoteName: string;
  remoteEntry: string;
  exposedModule: string;
  description: string;
}

export const REMOTE_REGISTRY: readonly RemoteDefinition[] = [
  {
    domain: 'json-mapper',
    routePath: '/integracoes/json-mapper',
    remoteName: 'jsonMapper',
    remoteEntry: 'http://localhost:3000/remoteEntry.json',
    exposedModule: './RemoteEntry',
    description: 'Remote piloto do mapeador JSON para a plataforma corporativa.'
  }
];

import type { RemoteModule } from '@porto/shared-contracts';

export async function loadJsonMapperRemote(): Promise<RemoteModule> {
  const remote = await import('json_mapper_remote/remote-entry');
  return remote.default;
}

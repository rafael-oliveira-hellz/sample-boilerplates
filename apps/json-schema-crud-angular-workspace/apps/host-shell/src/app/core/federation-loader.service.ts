import { Injectable } from '@angular/core';
import { RemoteModule } from '@shared/contracts';

interface NativeFederationRuntime {
  loadRemoteModule(remoteName: string, exposedModule: string): Promise<{ default: RemoteModule }>;
}

const NATIVE_FEDERATION_SPECIFIER = '@angular-architects/native-federation';
const loadNativeFederationRuntime = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<NativeFederationRuntime>;

@Injectable({ providedIn: 'root' })
export class FederationLoaderService {
  async load(remoteName: string, exposedModule: string): Promise<RemoteModule> {
    const nativeFederation = await loadNativeFederationRuntime(NATIVE_FEDERATION_SPECIFIER);
    const module = await nativeFederation.loadRemoteModule(remoteName, exposedModule);
    return module.default as RemoteModule;
  }
}

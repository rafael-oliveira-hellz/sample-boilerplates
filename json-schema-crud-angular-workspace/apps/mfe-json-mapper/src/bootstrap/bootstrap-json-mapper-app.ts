import { ApplicationRef, ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { AppComponent } from '../app/app.component';
import { appConfig } from '../app/app.config';
import { RemoteMountOptions, ShellContext } from '../../../../libs/shared/contracts/src';
import { provideShellContext } from '../../../../libs/shared/runtime/src';

export interface JsonMapperBootstrapOptions {
  hostElement?: HTMLElement;
  shellContext?: Partial<ShellContext>;
}

export async function bootstrapJsonMapperApp(
  options?: JsonMapperBootstrapOptions
): Promise<ApplicationRef> {
  const hostElement = ensureHostElement(options?.hostElement);
  const config = mergeApplicationConfig(appConfig, createEmbeddedAppConfig(options?.shellContext));
  const applicationRef = await createApplication(config);
  applicationRef.bootstrap(AppComponent, hostElement);
  return applicationRef;
}

function createEmbeddedAppConfig(shellContext?: Partial<ShellContext>): ApplicationConfig {
  return {
    providers: [provideShellContext(shellContext)]
  };
}

function ensureHostElement(existing?: HTMLElement): HTMLElement {
  if (existing) {
    return existing;
  }

  const current = document.querySelector('app-root');
  if (current instanceof HTMLElement) {
    return current;
  }

  const created = document.createElement('app-root');
  document.body.appendChild(created);
  return created;
}

export async function mountJsonMapperRemote(options: RemoteMountOptions): Promise<ApplicationRef> {
  options.hostElement.innerHTML = '';
  const root = document.createElement('app-root');
  options.hostElement.appendChild(root);
  return bootstrapJsonMapperApp({
    hostElement: root,
    shellContext: options.context
  });
}


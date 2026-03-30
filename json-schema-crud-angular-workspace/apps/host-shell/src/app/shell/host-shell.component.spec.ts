import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HostShellComponent } from './host-shell.component';
import { HostShellFacade } from './host-shell.facade';
import { FederationLoaderService } from '../core/federation-loader.service';
import { AppEvent, RemoteModule, ShellContext } from '@shared/contracts';

const shellContext: ShellContext = {
  apiBaseUrl: 'http://localhost:8080/api',
  locale: 'pt-BR',
  theme: 'porto-light',
  featureFlags: {
    mapperPreviewModal: true,
    federatedRemotes: true
  },
  session: {
    userId: 'qa.porto',
    tenantId: 'porto',
    roles: ['admin']
  }
};

const recentEvents: AppEvent[] = [
  {
    type: 'AUTH/SESSION_UPDATED',
    payload: shellContext.session
  }
];

describe('HostShellComponent', () => {
  let fixture: ComponentFixture<HostShellComponent>;
  let mountSpy: jasmine.Spy;
  let unmountSpy: jasmine.Spy;
  let federationLoaderSpy: jasmine.SpyObj<FederationLoaderService>;
  let facadeStub: HostShellFacade;

  beforeEach(async () => {
    mountSpy = jasmine.createSpy('mount').and.resolveTo();
    unmountSpy = jasmine.createSpy('unmount').and.resolveTo();
    federationLoaderSpy = jasmine.createSpyObj<FederationLoaderService>('FederationLoaderService', ['load']);
    federationLoaderSpy.load.and.resolveTo({
      mount: mountSpy,
      unmount: unmountSpy
    } satisfies RemoteModule);

    facadeStub = {
      eventBus: { emit: jasmine.createSpy('emit') },
      contextStore: {} as never,
      remotes: [
        {
          domain: 'json-mapper',
          routePath: '/integracoes/json-mapper',
          remoteName: 'jsonMapper',
          remoteEntry: 'http://localhost:3000/remoteEntry.json',
          exposedModule: './RemoteEntry',
          description: 'Remote piloto do mapeador JSON para a plataforma corporativa.'
        }
      ],
      shellContext: signal(shellContext),
      recentEvents: signal(recentEvents)
    } as unknown as HostShellFacade;

    await TestBed.configureTestingModule({
      imports: [HostShellComponent],
      providers: [
        { provide: HostShellFacade, useValue: facadeStub },
        { provide: FederationLoaderService, useValue: federationLoaderSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(HostShellComponent);
  });

  it('mounts the remote from native federation using the manifest name', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    expect(federationLoaderSpy.load).toHaveBeenCalledWith('jsonMapper', './RemoteEntry');
    expect(mountSpy).toHaveBeenCalled();
    expect(fixture.componentInstance.status()).toBe('mounted');
  });

  it('unmounts the remote on destroy', async () => {
    fixture.detectChanges();
    await fixture.whenStable();

    await fixture.componentInstance.ngOnDestroy();

    expect(unmountSpy).toHaveBeenCalled();
  });
});

import { TestBed } from '@angular/core/testing';
import { HostShellFacade } from './host-shell.facade';

describe('HostShellFacade', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('exposes shell context and remote registry', () => {
    const facade = TestBed.inject(HostShellFacade);

    expect(facade.remotes.length).toBe(1);
    expect(facade.remotes[0].remoteName).toBe('jsonMapper');
    expect(facade.shellContext().session.tenantId).toBe('porto');
  });
});

import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RemoteModule } from '@shared/contracts';
import { FederationLoaderService } from '../core/federation-loader.service';
import { HostShellFacade } from './host-shell.facade';

@Component({
  selector: 'host-shell-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './host-shell.component.html',
  styleUrl: './host-shell.component.scss'
})
export class HostShellComponent implements AfterViewInit, OnDestroy {
  private readonly facade = inject(HostShellFacade);
  private readonly federationLoader = inject(FederationLoaderService);
  readonly remotes = this.facade.remotes;
  readonly shellContext = this.facade.shellContext;
  readonly recentEvents = this.facade.recentEvents;
  readonly status = signal<'idle' | 'loading' | 'mounted' | 'error'>('idle');

  @ViewChild('remoteHost', { static: true })
  private readonly remoteHost?: ElementRef<HTMLDivElement>;

  private mountedRemote: RemoteModule | null = null;

  async ngAfterViewInit(): Promise<void> {
    this.status.set('loading');

    try {
      const remoteDefinition = this.remotes[0];
      const remote = await this.federationLoader.load(remoteDefinition.remoteName, remoteDefinition.exposedModule);
      this.mountedRemote = remote;
      await remote.mount({
        hostElement: this.remoteHost!.nativeElement,
        context: this.shellContext(),
        onEvent: (event) => this.facade.eventBus.emit(event)
      });
      this.status.set('mounted');
    } catch (error) {
      console.error(error);
      this.status.set('error');
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.mountedRemote?.unmount();
    this.mountedRemote = null;
  }
}

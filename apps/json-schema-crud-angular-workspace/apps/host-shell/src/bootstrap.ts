import { bootstrapApplication } from '@angular/platform-browser';
import { HostShellComponent } from './app/shell/host-shell.component';
import { appConfig } from './app/app.config';

bootstrapApplication(HostShellComponent, appConfig).catch((err) => console.error(err));

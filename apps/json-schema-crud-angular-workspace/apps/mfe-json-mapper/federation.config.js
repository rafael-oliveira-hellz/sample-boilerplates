const { withNativeFederation, share } = require('@angular-architects/native-federation/config');

const sharedConfig = share({
  '@angular/animations': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  '@angular/common': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  '@angular/compiler': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  '@angular/core': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  '@angular/forms': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  '@angular/platform-browser': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  '@angular/platform-browser-dynamic': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  '@angular/router': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  'rxjs': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  'tslib': { singleton: true, strictVersion: true, requiredVersion: 'auto' },
  'zone.js': { singleton: true, strictVersion: true, requiredVersion: 'auto' }
});

const workspaceSkips = [
  '@app/*',
  '@core/*',
  '@features/*',
  '@shared-ui/*',
  '@models/*',
  '@utils/*',
  '@shared/contracts',
  '@shared/contracts/*',
  '@shared/runtime',
  '@shared/runtime/*',
  '@shared/design-system',
  '@shared/design-system/*',
  '@mfe/json-mapper'
];

module.exports = withNativeFederation({
  name: 'jsonMapper',
  exposes: {
    './RemoteEntry': './apps/mfe-json-mapper/src/microfront/remote-entry.ts',
  },
  shared: {
    ...sharedConfig,
  },
  skip: [
    ...workspaceSkips,
    'rxjs/ajax',
    'rxjs/fetch',
    'rxjs/testing',
    'rxjs/webSocket',
  ]
});

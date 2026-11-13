import packageInfo from '../package.json' with { type: 'json' };

// Keep the UI, update checks and server requests on the shipped version.
export const APP_VERSION = packageInfo.version;

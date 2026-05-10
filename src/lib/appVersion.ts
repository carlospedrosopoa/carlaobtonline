import packageJson from '../../package.json';

const fallbackVersion = packageJson.version || '0.0.0';

export const APP_VERSION =
  process.env.NEXT_PUBLIC_APP_VERSION?.trim() || fallbackVersion;

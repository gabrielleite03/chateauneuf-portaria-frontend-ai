import { AppVersion } from './types';

const metaEnv = import.meta.env as Record<string, string | undefined>;

export const frontendVersion: AppVersion = {
  service: 'frontend',
  version: metaEnv.VITE_APP_VERSION || 'dev',
  commit: metaEnv.VITE_GIT_COMMIT || 'unknown',
};

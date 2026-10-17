import { appConfig } from './app.config';
import { databaseConfig } from './database.config';
import { authConfig } from './auth.config';
import { aiConfig } from './ai.config';
import { storageConfig } from './storage.config';
import { billingConfig } from './billing.config';

export const configuration = [
  appConfig,
  databaseConfig,
  authConfig,
  aiConfig,
  storageConfig,
  billingConfig,
];

export * from './app.config';
export * from './database.config';
export * from './auth.config';
export * from './ai.config';
export * from './storage.config';
export * from './billing.config';

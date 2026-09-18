// Centralized runtime configuration. No secrets are logged.
export const config = {
  port: Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
} as const;

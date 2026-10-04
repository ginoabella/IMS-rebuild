import { defineConfig, env } from 'prisma/config';
export default defineConfig({
  schema: '../../infra/database/schema.prisma',
  migrations: { path: '../../infra/database/migrations' },
  datasource: { url: env('DATABASE_URL') },
});

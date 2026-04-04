// Prisma 7 configuration file.
// The datasource URL is no longer in prisma/schema.prisma — it lives here.
//
// ── Migrations / CLI (prisma migrate, prisma db push, prisma studio) ──────────
// DATABASE_URL must be a libsql file URL, e.g.: file:./prisma/dev.db
// Add DATABASE_URL to config/.env.secrets.
//
// ── PrismaClient (runtime) ────────────────────────────────────────────────────
// Prisma 7 requires an adapter for direct connections — the URL here is only
// used by the Prisma CLI. To instantiate PrismaClient, use @prisma/adapter-libsql:
//
//   import { createClient } from '@libsql/client'
//   import { PrismaLibSQL } from '@prisma/adapter-libsql'
//   import { PrismaClient } from '@prisma/client'
//
//   const libsql = createClient({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
//   const adapter = new PrismaLibSQL(libsql)
//   export const prisma = new PrismaClient({ adapter })
//
// Required packages (not yet installed):
//   pnpm add @prisma/client @prisma/adapter-libsql @libsql/client

import { defineConfig } from 'prisma/config';

export default defineConfig({
	schema: 'prisma/schema.prisma',
	datasource: {
		url: process.env['DATABASE_URL'] ?? 'file:./prisma/dev.db',
	},
});

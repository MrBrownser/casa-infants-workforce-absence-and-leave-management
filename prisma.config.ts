// Load local secrets the same way Next.js does: `.env.local` first, then `.env`.
import { config } from "dotenv";
config({ path: [".env.local", ".env"], quiet: true });
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // CLI commands (migrate / db push / studio) use the DIRECT connection
    // (Supabase port 5432). Falls back to DATABASE_URL if DIRECT_URL is unset.
    // The runtime app uses the pooled URL via src/lib/prisma.ts.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});

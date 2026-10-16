-- Close every table to Supabase's Data API (PostgREST): Row Level Security on,
-- no policies, so the anon and authenticated roles can read or write no rows.
-- The app connects as the table owner through Prisma, which RLS does not
-- restrict (no FORCE), so it keeps working unchanged. Defence in depth next to
-- turning the Data API off in the production project.
ALTER TABLE "houses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

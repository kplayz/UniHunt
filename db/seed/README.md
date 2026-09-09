Seed data for UniHunt

This folder contains small synthetic samples for local development only. Replace with licensed datasets before production.

How to load (Postgres):

psql $DATABASE_URL -f db/migrations/001_init.sql
psql $DATABASE_URL -f db/seed/001_sample_universities_and_courses.sql

Recommended real datasets to source from (verify licenses):
- National open education registries (country-specific)
- Wikidata (use SPARQL and check item sources)
- data.gov and national data portals (public domain for US)

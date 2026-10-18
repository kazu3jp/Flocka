ALTER TABLE testimonies ADD COLUMN visibility_revision INTEGER NOT NULL DEFAULT 1;
ALTER TABLE blocks ADD COLUMN mutation_id TEXT NOT NULL DEFAULT '';
UPDATE blocks SET mutation_id = lower(hex(randomblob(16))) WHERE mutation_id = '';

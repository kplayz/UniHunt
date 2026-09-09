-- 005_course_embeddings.sql

-- Table to store precomputed embeddings for courses
CREATE TABLE IF NOT EXISTS course_embeddings (
  course_id uuid PRIMARY KEY,
  embedding jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_course_embeddings_course_id ON course_embeddings(course_id);

-- 001_init.sql

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY,
  full_name text,
  username text UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Universities
CREATE TABLE IF NOT EXISTS universities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country text,
  city text,
  website text,
  qs_rank integer,
  tuition_min numeric,
  tuition_max numeric,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university_id uuid REFERENCES universities(id) ON DELETE CASCADE,
  code text,
  name text NOT NULL,
  level text,
  duration_months integer,
  tuition_estimate numeric,
  overview text,
  requirements jsonb,
  created_at timestamptz DEFAULT now()
);

-- Shortlists
CREATE TABLE IF NOT EXISTS shortlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shortlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortlist_id uuid REFERENCES shortlists(id) ON DELETE CASCADE,
  university_id uuid,
  course_id uuid,
  note text,
  added_at timestamptz DEFAULT now()
);

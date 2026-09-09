-- 001_sample_universities_and_courses.sql
-- Small synthetic sample dataset for local development.

-- Universities
INSERT INTO universities (id, name, country, city, website, qs_rank, tuition_min, tuition_max, metadata)
VALUES
  ('11111111-1111-1111-1111-111111111111','Sample University A','United States','Boston','https://www.samplea.edu',50,10000,30000, '{}'),
  ('22222222-2222-2222-2222-222222222222','Sample University B','United Kingdom','London','https://www.sampleb.ac.uk',75,15000,35000, '{}'),
  ('33333333-3333-3333-3333-333333333333','Sample University C','Australia','Sydney','https://www.samplec.edu.au',120,12000,28000, '{}');

-- Courses
INSERT INTO courses (id, university_id, code, name, level, duration_months, tuition_estimate, overview)
VALUES
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1','11111111-1111-1111-1111-111111111111','BSCS','B.Sc. Computer Science','Undergraduate',36,20000,'Computer science program covering algorithms, systems, and AI.'),
  ('aaaaaaa2-aaaa-aaaa-aaaa-aaaaaaaaaaa2','11111111-1111-1111-1111-111111111111','MSAI','M.Sc. Artificial Intelligence','Postgraduate',24,25000,'Advanced AI topics including ML, NLP, and robotics.'),
  ('bbbbbbb1-bbbb-bbbb-bbbb-bbbbbbbbbbb1','22222222-2222-2222-2222-222222222222','BAECON','B.A. Economics','Undergraduate',36,18000,'Economics with options in development and econometrics.'),
  ('ccccccc1-cccc-cccc-cccc-ccccccccccc1','33333333-3333-3333-3333-333333333333','MSDS','M.Sc. Data Science','Postgraduate',18,30000,'Data science program focused on applied statistics and ML.');

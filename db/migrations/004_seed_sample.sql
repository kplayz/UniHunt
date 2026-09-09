-- 004_seed_sample.sql
-- Insert licensed sample data for development/testing (replace with real licensed data in production)

INSERT INTO universities (id, name, country, city, website, qs_rank, tuition_min, tuition_max, metadata)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Example Tech University', 'United States', 'Springfield', 'https://example.edu', 120, 15000, 35000, '{"public": true}'),
  ('22222222-2222-2222-2222-222222222222', 'Global Medical College', 'United Kingdom', 'London', 'https://globalmed.ac.uk', 85, 20000, 45000, '{"public": false}');

INSERT INTO courses (id, university_id, code, name, level, duration_months, tuition_estimate, overview, requirements)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'ENG-ROB-UG', 'BEng Robotics and Mechatronics', 'Undergraduate', 48, 25000, 'Robotics and mechatronics programme focusing on automation.', '{"gpa": 3.0}'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'MED-BS', 'MBBS Medicine', 'Undergraduate', 60, 40000, 'Medical degree with clinical rotations.', '{"gpa": 3.5}');

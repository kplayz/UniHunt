-- 003_create_search_view.sql

-- Create a view to simplify searching courses joined with university data
CREATE OR REPLACE VIEW course_search AS
SELECT
  c.id as course_id,
  c.name as course_name,
  c.code as course_code,
  c.level as course_level,
  c.duration_months,
  c.tuition_estimate,
  c.overview,
  c.requirements,
  u.id as university_id,
  u.name as university_name,
  u.country,
  u.city,
  u.website as university_website,
  u.qs_rank
FROM courses c
JOIN universities u ON c.university_id = u.id;

export type CourseLevel =
  | "Diploma"
  | "Certificate"
  | "Associate"
  | "Undergraduate"
  | "Postgraduate"
  | "Masters"
  | "Doctorate"
  | "Postdoctoral";

export type CourseType =
  | "Engineering"
  | "Medicine"
  | "Bachelor's"
  | "Master's"
  | "Masters Integrated"
  | "PhD"
  | "Business"
  | "Law"
  | "Arts & Humanities"
  | "Science"
  | "Technology"
  | "Other";

export type CandidateType = "in-state" | "out-of-state" | "out-of-country";

export interface SearchCriteria {
  courseLevel: CourseLevel | "";
  courseType: CourseType | "";
  specialization: string;
  countries: string[];
  candidateType: CandidateType | "";
  lastQualification: string;
  lastSchool: string;
  curriculum: string;
  subjects: string;
  grades: string;
  budgetMax: string;
  additionalNotes: string;
}

/**
 * Wire format accepted by the search API: the same shape as `SearchCriteria`,
 * but with the form's literal unions widened to plain strings so request
 * validation does not have to re-declare them.
 */
export type SearchCriteriaInput = Omit<
  SearchCriteria,
  "courseLevel" | "courseType" | "candidateType"
> & {
  courseLevel: string;
  courseType: string;
  candidateType: string;
};

export interface UniversityCourseResult {
  id: string;
  universityName: string;
  universityLocation: string;
  courseName: string;
  courseLevel: string;
  courseType: string;
  specialization: string;
  country: string;
  qsWorldRanking: number | null;
  tuitionFee: string;
  admissionRequirements: string;
  courseUrl: string;
  duration: string;
  language: string;
  intakePeriod: string;
  scholarshipInfo: string;
}

export interface ShortlistedCourse {
  id: string;
  user_id: string;
  university_name: string;
  university_location: string | null;
  course_name: string;
  course_level: string | null;
  course_type: string | null;
  specialization: string | null;
  country: string | null;
  qs_world_ranking: number | null;
  tuition_fee: string | null;
  admission_requirements: string | null;
  course_url: string | null;
  duration: string | null;
  language: string | null;
  intake_period: string | null;
  scholarship_info: string | null;
  notes: string | null;
  is_manual: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShortlistInsert {
  university_name: string;
  university_location?: string;
  course_name: string;
  course_level?: string;
  course_type?: string;
  specialization?: string;
  country?: string;
  qs_world_ranking?: number | null;
  tuition_fee?: string;
  admission_requirements?: string;
  course_url?: string;
  duration?: string;
  language?: string;
  intake_period?: string;
  scholarship_info?: string;
  notes?: string;
  is_manual?: boolean;
}

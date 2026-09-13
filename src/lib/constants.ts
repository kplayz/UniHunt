import type {
  CandidateType,
  CourseLevel,
  CourseType,
  SearchCriteria,
} from "./types";

export const COURSE_LEVELS: CourseLevel[] = [
  "Diploma",
  "Certificate",
  "Associate",
  "Undergraduate",
  "Postgraduate",
  "Masters",
  "Doctorate",
  "Postdoctoral",
];

export const COURSE_TYPES: CourseType[] = [
  "Engineering",
  "Medicine",
  "Bachelor's",
  "Master's",
  "Masters Integrated",
  "PhD",
  "Business",
  "Law",
  "Arts & Humanities",
  "Science",
  "Technology",
  "Other",
];

export const CANDIDATE_TYPES: { value: CandidateType; label: string }[] = [
  { value: "in-state", label: "In-State (domestic, same state/province)" },
  { value: "out-of-state", label: "Out-of-State (domestic, different region)" },
  { value: "out-of-country", label: "Out-of-Country (international)" },
];

export const DEFAULT_SEARCH_CRITERIA: SearchCriteria = {
  courseLevel: "",
  courseType: "",
  specialization: "",
  countries: [],
  candidateType: "",
  lastQualification: "",
  lastSchool: "",
  curriculum: "",
  subjects: "",
  grades: "",
  budgetMax: "",
  additionalNotes: "",
};

export interface ChecklistItem {
  label: string;
  required: boolean;
  details: string;
}

interface ChecklistCourse {
  courseLevel?: string | null;
  courseType?: string | null;
  language?: string | null;
  admissionRequirements?: string | null;
  scholarshipInfo?: string | null;
}

const CONDITIONAL: Array<{ pattern: RegExp; label: string; details: string }> = [
  {
    pattern: /ielts|toefl|pte|duolingo|english proficiency|language test/i,
    label: "English proficiency test",
    details: "IELTS, TOEFL, PTE, or the test named by the university.",
  },
  {
    pattern: /\bgre\b|\bgmat\b|\bsat\b|\bact\b|bitsat|jee|entrance test|entrance exam/i,
    label: "Entrance or standardized test score",
    details: "The score report for the test this course requires.",
  },
  {
    pattern: /portfolio|design samples|work samples/i,
    label: "Portfolio",
    details: "Work samples in the format the course page describes.",
  },
  {
    pattern: /research proposal|statement of research/i,
    label: "Research proposal",
    details: "Proposal requested for research degrees.",
  },
  {
    pattern: /medical|fitness certificate|health/i,
    label: "Medical or fitness certificate",
    details: "Only if the university asks for one.",
  },
  {
    pattern: /experience letter|work experience|resume|curriculum vitae|\bcv\b/i,
    label: "CV and work-experience letters",
    details: "CV plus proof of experience when the course asks for it.",
  },
];

/**
 * Documents an applicant should prepare. The baseline set is always included;
 * extra rows are added only when the course text names them.
 */
export function buildDocumentChecklist(course: ChecklistCourse): ChecklistItem[] {
  const text = `${course.admissionRequirements ?? ""} ${course.scholarshipInfo ?? ""} ${course.language ?? ""} ${course.courseType ?? ""} ${course.courseLevel ?? ""}`;
  const postgraduate = /master|postgrad|mba|doctor|ph\.?d|postdoc/i.test(course.courseLevel ?? "");
  const items: ChecklistItem[] = [
    {
      label: "Application form",
      required: true,
      details: "The university's own online or PDF application.",
    },
    {
      label: "Academic transcripts",
      required: true,
      details: "Official marksheets or transcripts for the qualification you are applying with.",
    },
    {
      label: postgraduate ? "Degree certificate" : "School leaving or predicted grades",
      required: true,
      details: postgraduate
        ? "Provisional or final degree certificate."
        : "Leaving certificate, predicted grades, or the equivalent.",
    },
    {
      label: "Passport or government ID",
      required: true,
      details: "A current photo identity page.",
    },
    {
      label: "Passport photograph",
      required: true,
      details: "A recent photo that matches the university's size rules.",
    },
    {
      label: "Statement of purpose",
      required: true,
      details: "Personal statement written for this course.",
    },
    {
      label: "Letters of recommendation",
      required: true,
      details: "Usually two academic or professional referees.",
    },
    {
      label: "CV",
      required: !/undergrad|bachelor|diploma/i.test(course.courseLevel ?? ""),
      details: "Education, projects, and activities.",
    },
    {
      label: "Proof of funds",
      required: true,
      details: "Bank statement or sponsor letter covering tuition and living costs.",
    },
  ];

  if (/english/i.test(course.language ?? "") || /ielts|toefl|english/i.test(text)) {
    items.push({
      label: "English proficiency test",
      required: /ielts|toefl|pte|duolingo|english proficiency/i.test(text),
      details: "Required when the university names an English test. Optional when the course is taught in English but no test is listed.",
    });
  }

  for (const rule of CONDITIONAL) {
    if (rule.pattern.test(text)) {
      items.push({ label: rule.label, required: true, details: rule.details });
    }
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

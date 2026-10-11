import type { SearchCriteriaInput } from "./types";

export interface SeedSource {
  title: string;
  url: string;
  description: string;
  extraSnippets: string[];
}

interface KnownProgramme {
  universityName: string;
  location: string;
  country: string;
  courseName: string;
  courseUrl: string;
  courseLevel: string;
  topics: string[];
}

/**
 * Official course pages at nationally known universities that generic web
 * search often buries under aggregator and SEO-college results.
 */
const KNOWN_PROGRAMMES: KnownProgramme[] = [
  {
    universityName: "BITS Pilani",
    location: "Pilani, Rajasthan, India",
    country: "India",
    courseName: "B.E. Robotics and Industrial Automation",
    courseUrl:
      "https://www.bits-pilani.ac.in/academics/integrated-first-degree/b-e-robotics-and-industrial-automation/",
    courseLevel: "undergraduate",
    topics: ["robot", "mechatronic", "autonomous", "automation"],
  },
  {
    universityName: "Manipal Academy of Higher Education (MIT Manipal)",
    location: "Manipal, Karnataka, India",
    country: "India",
    courseName: "B.Tech Mechatronics Engineering / Robotics & AI",
    courseUrl:
      "https://www.manipal.edu/mit/program-list/btech/btech-mechatronics-engineering.html",
    courseLevel: "undergraduate",
    topics: ["robot", "mechatronic", "autonomous", "automation"],
  },
  {
    universityName: "Vellore Institute of Technology (VIT)",
    location: "Vellore, Tamil Nadu, India",
    country: "India",
    courseName: "B.Tech Mechanical Engineering (Robotics) / CSE (AI & Robotics)",
    courseUrl: "https://vit.ac.in/admissions/programmes-offered",
    courseLevel: "undergraduate",
    topics: ["robot", "mechatronic", "autonomous", "automation"],
  },
  {
    universityName: "Symbiosis Institute of Technology (Symbiosis International University)",
    location: "Pune, Maharashtra, India",
    country: "India",
    courseName: "B.Tech Robotics and Automation",
    courseUrl: "https://www.sitpune.edu.in/btech-robotics",
    courseLevel: "undergraduate",
    topics: ["robot", "mechatronic", "autonomous", "automation"],
  },
  {
    universityName: "Plaksha University",
    location: "Mohali, Chandigarh, India",
    country: "India",
    courseName: "B.Tech in Robotics & Autonomous Systems",
    courseUrl:
      "https://plaksha.edu.in/ug/btech-degree/robotics-autonomous-systems",
    courseLevel: "undergraduate",
    topics: ["robot", "mechatronic", "autonomous"],
  },
];

export function seedCourseSources(criteria: SearchCriteriaInput): SeedSource[] {
  const subject = `${criteria.specialization} ${criteria.courseType}`.toLowerCase();
  const level = criteria.courseLevel.trim().toLowerCase();
  const countries = criteria.countries
    .map((country) => country.trim().toLowerCase())
    .filter(Boolean);

  return KNOWN_PROGRAMMES.filter((programme) => {
    if (
      countries.length > 0 &&
      !countries.includes(programme.country.toLowerCase())
    ) {
      return false;
    }
    if (level && programme.courseLevel !== level) return false;
    return programme.topics.some((topic) => subject.includes(topic));
  }).map((programme) => ({
    title: `${programme.courseName} | ${programme.universityName}`,
    url: programme.courseUrl,
    description: `${programme.universityName}, ${programme.location}. Official ${programme.courseName} page.`,
    extraSnippets: [programme.location],
  }));
}

const MAJOR_HOST_SUFFIXES = [
  "bits-pilani.ac.in",
  "vit.ac.in",
  "vitap.ac.in",
  "manipal.edu",
  "sitpune.edu.in",
  "siu.edu.in",
  "plaksha.edu.in",
  "iisc.ac.in",
  "iitb.ac.in",
  "iitd.ac.in",
  "iitm.ac.in",
  "iitk.ac.in",
  "iitkgp.ac.in",
  "iitr.ac.in",
  "iitg.ac.in",
  "iith.ac.in",
  "iitbhu.ac.in",
  "iitism.ac.in",
  "nitk.ac.in",
  "nitt.edu",
  "nits.ac.in",
  "dtu.ac.in",
  "nsut.ac.in",
  "iiit.ac.in",
  "iiitd.ac.in",
  "iiith.ac.in",
  "iiitb.ac.in",
  "amrita.edu",
  "annauniv.edu",
  "jaduniv.edu.in",
  "caluniv.ac.in",
  "du.ac.in",
  "jnu.ac.in",
  "uohyd.ac.in",
  "mit.edu",
  "stanford.edu",
  "berkeley.edu",
  "cmu.edu",
  "gatech.edu",
  "umich.edu",
  "illinois.edu",
  "cornell.edu",
  "princeton.edu",
  "harvard.edu",
  "caltech.edu",
  "ox.ac.uk",
  "cam.ac.uk",
  "imperial.ac.uk",
  "ucl.ac.uk",
  "ed.ac.uk",
  "manchester.ac.uk",
  "utoronto.ca",
  "ubc.ca",
  "mcgill.ca",
  "nus.edu.sg",
  "ntu.edu.sg",
  "tsinghua.edu.cn",
  "pku.edu.cn",
];

const MAJOR_NAME_RE =
  /\b(iits?|nits?|bits(?:\s+pilani)?|vit|manipal|symbiosis|iisc|iiits?|anna university|jadavpur|delhi technological|nsut|amrita|oxford|cambridge|stanford|mit\b|imperial|ucl|caltech|cmu|georgia tech|harvard|princeton|nus|ntu)\b/i;

export function isMajorUniversity(universityName: string, url = ""): boolean {
  const haystack = `${universityName} ${url}`.toLowerCase();
  if (MAJOR_NAME_RE.test(haystack)) return true;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return MAJOR_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

export function majorUniversityScore(universityName: string, url = ""): number {
  return isMajorUniversity(universityName, url) ? 16 : 0;
}

/** Keep flagship universities when slicing search hits, instead of SEO colleges. */
export function prioritizeMajorUniversitySources<
  T extends { url: string; title?: string },
>(sources: T[], limit: number): T[] {
  if (limit <= 0) return [];
  const majors: T[] = [];
  const rest: T[] = [];
  for (const source of sources) {
    if (isMajorUniversity(source.title ?? "", source.url)) majors.push(source);
    else rest.push(source);
  }
  const majorKeep = Math.min(majors.length, limit);
  return [
    ...majors.slice(0, majorKeep),
    ...rest.slice(0, Math.max(0, limit - majorKeep)),
  ];
}

/** Extra Brave terms that surface flagship universities for a country. */
export function majorUniversityQueryTerms(country: string): string {
  switch (country.trim().toLowerCase()) {
    case "india":
      return "IIT BITS Pilani VIT Manipal Symbiosis NIT IISc";
    case "united states":
      return "MIT Stanford Berkeley Carnegie Mellon Georgia Tech";
    case "united kingdom":
      return "Oxford Cambridge Imperial UCL Edinburgh";
    case "canada":
      return "Toronto UBC McGill Waterloo";
    case "australia":
      return "Melbourne ANU Sydney UNSW Monash";
    case "singapore":
      return "NUS NTU";
    default:
      return "top university";
  }
}

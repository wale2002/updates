export type Opportunity = {
  slug: string;
  title: string;
  provider: string;
  category: string;
  summary: string;
  benefit: string;
  deadline: string;
  deadlineLabel: string;
  location: string;
  status: "OPEN" | "CLOSING SOON" | "UPCOMING";
  sourceTier: "Primary source" | "Partner verified";
  verifiedDate: string;
  officialDomain: string;
  applicationUrl: string;
  featured?: boolean;
  eligibility: string[];
  requirements: string[];
  tracks?: string[];
};

export const categories = [
  "All opportunities",
  "Grants",
  "Training",
  "Scholarships",
  "Jobs",
  "Fellowships",
  "Startup funding",
];

export const opportunities: Opportunity[] = [
  {
    slug: "digital-skills-nigeria-ai-foundations",
    title: "Digital Skills Nigeria: AI Foundations Cohort",
    provider: "National Information Technology Development Agency",
    category: "Training",
    summary: "A fully sponsored introductory programme covering practical AI skills, digital safety and workplace tools.",
    benefit: "Free training + certificate",
    deadline: "2026-10-12",
    deadlineLabel: "12 Oct 2026",
    location: "Nigeria · Online",
    status: "CLOSING SOON",
    sourceTier: "Primary source",
    verifiedDate: "7 Oct 2026",
    officialDomain: "nitda.gov.ng",
    applicationUrl: "https://nitda.gov.ng",
    featured: true,
    eligibility: ["Nigerian residents aged 18 or older", "Beginners interested in digital skills", "Access to a smartphone or computer"],
    requirements: ["Valid email address", "Basic personal information", "Commitment to complete the learning track"],
    tracks: ["AI foundations", "Digital productivity", "Online safety"],
  },
  {
    slug: "africa-scholars-undergraduate-programme",
    title: "Africa Scholars Undergraduate Programme",
    provider: "Mastercard Foundation Scholars Program",
    category: "Scholarships",
    summary: "Undergraduate scholarship support for academically strong young Africans with demonstrated leadership potential.",
    benefit: "Tuition + living support",
    deadline: "2026-10-26",
    deadlineLabel: "26 Oct 2026",
    location: "Africa · Partner universities",
    status: "OPEN",
    sourceTier: "Primary source",
    verifiedDate: "6 Oct 2026",
    officialDomain: "mastercardfdn.org",
    applicationUrl: "https://mastercardfdn.org/all/scholars/",
    eligibility: ["Citizens of an African country", "Applicants seeking undergraduate study", "Strong academic and community record"],
    requirements: ["Academic transcripts", "Personal statement", "Partner university application"],
  },
  {
    slug: "women-led-business-growth-fund",
    title: "Women-Led Business Growth Fund",
    provider: "Bank of Industry",
    category: "Grants",
    summary: "Business support pathway for women-led Nigerian enterprises ready to formalise, grow and create jobs.",
    benefit: "Business funding + advisory",
    deadline: "2026-10-31",
    deadlineLabel: "31 Oct 2026",
    location: "All 36 states + FCT",
    status: "OPEN",
    sourceTier: "Partner verified",
    verifiedDate: "5 Oct 2026",
    officialDomain: "boi.ng",
    applicationUrl: "https://www.boi.ng",
    featured: true,
    eligibility: ["Women founders or majority women-owned businesses", "Business operates in Nigeria", "Viable plan for growth and job creation"],
    requirements: ["CAC registration details", "Business plan", "Recent financial records where available"],
  },
  {
    slug: "graduate-policy-fellowship",
    title: "Graduate Policy & Innovation Fellowship",
    provider: "UNDP Nigeria",
    category: "Fellowships",
    summary: "A six-month placement for early-career graduates working on public innovation and sustainable development projects.",
    benefit: "Paid 6-month fellowship",
    deadline: "2026-11-08",
    deadlineLabel: "8 Nov 2026",
    location: "Abuja · Hybrid",
    status: "OPEN",
    sourceTier: "Primary source",
    verifiedDate: "7 Oct 2026",
    officialDomain: "undp.org",
    applicationUrl: "https://www.undp.org/nigeria/jobs",
    eligibility: ["Recent graduates with 0–3 years of experience", "Interest in policy or public innovation", "Eligible to work in Nigeria"],
    requirements: ["CV", "Short motivation statement", "Degree certificate or statement of result"],
  },
  {
    slug: "green-startup-accelerator",
    title: "Green Startup Accelerator — 2027 Intake",
    provider: "Climate Innovation Africa",
    category: "Startup funding",
    summary: "A structured accelerator for Nigerian startups solving climate, energy, agriculture and circular-economy challenges.",
    benefit: "₦5m pilot support",
    deadline: "2026-11-21",
    deadlineLabel: "21 Nov 2026",
    location: "Nigeria · Hybrid",
    status: "UPCOMING",
    sourceTier: "Partner verified",
    verifiedDate: "4 Oct 2026",
    officialDomain: "climateinnovation.africa",
    applicationUrl: "https://www.undp.org/nigeria",
    eligibility: ["Nigeria-based founding team", "Working prototype or early traction", "Climate-positive business model"],
    requirements: ["Pitch deck", "Founder profiles", "Pilot plan"],
  },
  {
    slug: "education-programme-officer",
    title: "Education Programme Officer",
    provider: "UNICEF Nigeria",
    category: "Jobs",
    summary: "Programme role supporting education access, partner coordination and evidence-led delivery.",
    benefit: "Full-time role",
    deadline: "2026-10-18",
    deadlineLabel: "18 Oct 2026",
    location: "Kano, Nigeria",
    status: "CLOSING SOON",
    sourceTier: "Primary source",
    verifiedDate: "7 Oct 2026",
    officialDomain: "unicef.org",
    applicationUrl: "https://www.unicef.org/careers/",
    eligibility: ["Relevant degree", "Professional programme experience", "Strong written and spoken English"],
    requirements: ["CV", "Cover letter", "Employment history"],
  },
];

export function getOpportunity(slug: string) {
  return opportunities.find((item) => item.slug === slug);
}

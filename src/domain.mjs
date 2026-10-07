export const EDITORIAL_STATES = ["draft", "awaiting_verification", "approved", "published", "expired", "retracted"];

export function deriveStatus({ openingDate, deadline, editorialStatus }, now = new Date()) {
  if (editorialStatus === "retracted") return "RETRACTED";
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  if (openingDate && new Date(`${openingDate}T00:00:00Z`) > today) return "UPCOMING";
  if (deadline) {
    const end = new Date(`${deadline}T23:59:59Z`);
    if (end < now) return "EXPIRED";
    if (Math.ceil((end.getTime() - now.getTime()) / 86400000) <= 14) return "CLOSING SOON";
  }
  return "OPEN";
}

export function isSafeOfficialUrl(value, officialDomain) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const expected = String(officialDomain || "").toLowerCase().replace(/^www\./, "");
    if (!expected || (host !== expected && !host.endsWith(`.${expected}`))) return false;
    if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.endsWith(".local")) return false;
    return true;
  } catch { return false; }
}

export function verificationCanPublish(opportunity, evidence) {
  return Boolean(opportunity && ["approved", "published"].includes(opportunity.editorialStatus) && opportunity.officialSourceUrl && opportunity.applicationUrl && opportunity.officialDomain && isSafeOfficialUrl(opportunity.officialSourceUrl, opportunity.officialDomain) && isSafeOfficialUrl(opportunity.applicationUrl, opportunity.officialDomain) && evidence?.reviewerId && evidence?.primarySourceUrl && evidence?.programmeOwner && evidence?.deadlineConfirmed && Number(evidence?.score) >= 70);
}

export function slugify(value) { return String(value || "").normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 96); }
export function parseJsonList(value) { if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 30); if (typeof value !== "string") return []; return value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 30); }

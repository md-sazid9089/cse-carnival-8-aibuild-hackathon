/**
 * AUST issues exactly one address per student — `<department>.<student id>@aust.edu` — so the
 * address carries both facts. The server re-derives them; this mirror only keeps the form honest.
 */
export const CAMPUS_DOMAIN = "aust.edu";
export const CAMPUS_EMAIL_EXAMPLE = `cse.20250999@${CAMPUS_DOMAIN}`;
export const CAMPUS_ONLY_NOTE = "CampusOS is built for AUST students only.";

const DOMAIN_RE = /@(?:[a-z0-9-]+\.)*aust\.edu$/i;
const CAMPUS_EMAIL_RE = /^([a-z]{2,10})\.(\d[a-z0-9-]{3,19})@(?:[a-z0-9-]+\.)*aust\.edu$/i;

export function isCampusEmail(value) {
  return DOMAIN_RE.test(String(value ?? "").trim());
}

export function parseCampusEmail(value) {
  const match = CAMPUS_EMAIL_RE.exec(String(value ?? "").trim());
  return match ? { department: match[1].toUpperCase(), studentId: match[2] } : null;
}

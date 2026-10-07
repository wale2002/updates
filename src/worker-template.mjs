import { deriveStatus, isSafeOfficialUrl, parseJsonList, slugify, verificationCanPublish } from "./domain.mjs";

const PUBLIC_HTML = decodeBase64("__PUBLIC_HTML_BASE64__");
const ADMIN_HTML = decodeBase64("__ADMIN_HTML_BASE64__");
const EVENTS = new Set(["page_view", "opportunity_view", "search", "category_filter", "save_opportunity", "share", "newsletter_signup", "official_apply_click", "report_listing"]);
const POLICY_PAGES = {
  "/about": ["About OpportunityNG", "OpportunityNG is an independent opportunity discovery and verification platform. We help people find legitimate programmes and continue to the organisation responsible for each application."],
  "/contact": ["Contact", "Questions, corrections and partnership enquiries can be submitted through our reporting and opportunity-submission forms. We never request application fees."],
  "/editorial-policy": ["Editorial policy", "Every listing must be useful, specific and grounded in an attributable source. AI may assist extraction and drafting, but a human editor remains responsible for verification and publication."],
  "/verification-policy": ["Verification policy", "A verified badge requires stored evidence: programme owner, primary source, official application destination, deadline review, reviewer identity and a recorded verification score."],
  "/corrections": ["Corrections policy", "We preserve revision history, investigate reports and clearly correct, expire, dispute or retract listings when facts change."],
  "/privacy": ["Privacy policy", "We collect only the information needed to operate alerts, editorial submissions, security and aggregate analytics. We do not sell personal information to advertisers."],
  "/terms": ["Terms of use", "OpportunityNG provides independent information. Programme owners set their own eligibility and make all application decisions. Always confirm details on the official destination."],
  "/advertising-policy": ["Advertising policy", "Advertising never determines verification. Sponsored content is labelled, reviewed and visually separated from official application actions."],
  "/disclaimer": ["Disclaimer", "OpportunityNG is an independent information platform and is not a government agency. Unless expressly stated, we do not administer the programmes listed."],
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (!env.DB) return response("Database binding is unavailable.", 503);
      if (request.method === "GET" && url.pathname === "/admin") return html(ADMIN_HTML, { "cache-control": "no-store" });
      if (url.pathname.startsWith("/api/")) return await api(request, env, url);
      if (request.method === "GET" && url.pathname.startsWith("/go/")) return await outbound(request, env, url);
      if (request.method === "GET" && url.pathname === "/sitemap.xml") return await sitemap(env, url);
      if (request.method === "GET" && url.pathname === "/robots.txt") return response(`User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${url.origin}/sitemap.xml\n`, 200, { "content-type": "text/plain; charset=utf-8" });
      if (request.method === "GET" && (url.pathname === "/report-an-opportunity" || url.pathname === "/submit-an-opportunity")) return html(formPage(url.pathname));
      if (request.method === "GET" && POLICY_PAGES[url.pathname]) return html(contentPage(...POLICY_PAGES[url.pathname]));
      if (request.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/opportunities/"))) {
        ctx.waitUntil(recordEvent(env.DB, "page_view", null, { path: url.pathname }));
        return await publicPage(env, url);
      }
      return response("Not found", 404);
    } catch (error) {
      console.error("request_failed", error);
      if (url.pathname.startsWith("/api/")) return json({ error: "The service is temporarily unavailable." }, 500);
      return response("OpportunityNG is temporarily unavailable. Please try again.", 503);
    }
  },
};

async function api(request, env, url) {
  const path = url.pathname;
  if (request.method === "GET" && path === "/api/opportunities") return json({ opportunities: await publicOpportunities(env.DB) });
  if (request.method === "GET" && path.startsWith("/api/opportunities/")) {
    const slug = decodeURIComponent(path.slice("/api/opportunities/".length));
    const item = await publicOpportunity(env.DB, slug);
    return item ? json({ opportunity: item }) : json({ error: "Opportunity not found" }, 404);
  }
  if (request.method === "POST" && path === "/api/subscribers") return subscribe(request, env.DB);
  if (request.method === "POST" && path === "/api/reports") return createReport(request, env.DB);
  if (request.method === "POST" && path === "/api/events") return analytics(request, env.DB);
  if (path.startsWith("/api/admin/")) return adminApi(request, env.DB, path);
  return json({ error: "Not found" }, 404);
}

async function publicOpportunities(db) {
  const result = await db.prepare(`SELECT o.*, p.name provider, c.name category FROM opportunities o JOIN providers p ON p.id=o.provider_id JOIN categories c ON c.id=o.category_id WHERE o.editorial_status='published' AND o.verification_status IN ('verified','partner_verified') ORDER BY COALESCE(o.deadline,'9999-12-31'), o.published_at DESC`).all();
  return result.results.map(publicRow);
}

async function publicOpportunity(db, slug) {
  const row = await db.prepare(`SELECT o.*, p.name provider, c.name category, v.score verification_score, v.reviewed_at, v.notes verification_notes FROM opportunities o JOIN providers p ON p.id=o.provider_id JOIN categories c ON c.id=o.category_id LEFT JOIN verification_records v ON v.id=(SELECT id FROM verification_records WHERE opportunity_id=o.id ORDER BY reviewed_at DESC LIMIT 1) WHERE o.slug=? AND o.editorial_status='published' AND o.verification_status IN ('verified','partner_verified') LIMIT 1`).bind(slug).first();
  return row ? publicRow(row) : null;
}

function publicRow(row) {
  return { id: row.id, slug: row.slug, title: row.title, provider: row.provider, category: row.category, summary: row.summary, benefit: row.benefit || "Not stated by the programme owner", eligibility: safeArray(row.eligibility_json), requirements: safeArray(row.requirements_json), location: row.location, openingDate: row.opening_date, deadline: row.deadline, deadlineLabel: formatDate(row.deadline), status: deriveStatus({ openingDate: row.opening_date, deadline: row.deadline, editorialStatus: row.editorial_status }), tier: row.verification_status === "partner_verified" ? "Partner verified" : "Primary source", verified: formatDate(row.verified_at), officialDomain: row.official_domain, officialSourceUrl: row.official_source_url, verificationScore: row.verification_score || null, verificationNotes: row.verification_notes || null };
}

async function subscribe(request, db) {
  const body = await bodyJson(request);
  const email = String(body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: "Enter a valid email address." }, 400);
  const categories = parseJsonList(body.categories || []);
  const token = crypto.randomUUID();
  const hash = await sha256(token);
  await db.prepare(`INSERT INTO newsletter_subscribers (email,categories_json,status,verification_token_hash,updated_at) VALUES (?,?, 'pending', ?, CURRENT_TIMESTAMP) ON CONFLICT(email) DO UPDATE SET categories_json=excluded.categories_json,status='pending',verification_token_hash=excluded.verification_token_hash,updated_at=CURRENT_TIMESTAMP`).bind(email, JSON.stringify(categories), hash).run();
  await recordEvent(db, "newsletter_signup", null, { categories });
  return json({ ok: true, status: "pending", message: "Check your inbox when email delivery is connected." }, 201);
}

async function createReport(request, db) {
  const body = await bodyJson(request);
  const type = ["deadline_wrong", "application_closed", "suspicious_link", "eligibility_wrong", "programme_cancelled", "opportunity_submission", "general"].includes(body.reportType) ? body.reportType : "general";
  const message = String(body.message || "").trim().slice(0, 4000);
  const email = String(body.email || "").trim().slice(0, 254) || null;
  if (message.length < 10) return json({ error: "Please provide a little more detail." }, 400);
  await db.prepare(`INSERT INTO reports (opportunity_id,report_type,message,reporter_email) VALUES (?,?,?,?)`).bind(Number(body.opportunityId) || null, type, message, email).run();
  await recordEvent(db, "report_listing", Number(body.opportunityId) || null, { type });
  return json({ ok: true }, 201);
}

async function analytics(request, db) {
  const body = await bodyJson(request);
  if (!EVENTS.has(body.eventName)) return json({ error: "Unsupported event" }, 400);
  await recordEvent(db, body.eventName, Number(body.opportunityId) || null, sanitiseMetadata(body.metadata));
  return json({ ok: true }, 202);
}

async function outbound(request, env, url) {
  const id = Number(url.pathname.slice(4));
  if (!Number.isInteger(id) || id < 1) return response("Invalid opportunity", 400);
  const row = await env.DB.prepare(`SELECT id,application_url,official_domain FROM opportunities WHERE id=? AND editorial_status='published' AND verification_status IN ('verified','partner_verified') LIMIT 1`).bind(id).first();
  if (!row || !isSafeOfficialUrl(row.application_url, row.official_domain)) return response("Official destination unavailable", 404);
  const ua = request.headers.get("user-agent") || "";
  await env.DB.prepare(`INSERT INTO outbound_clicks (opportunity_id,referrer,campaign,utm_source,utm_medium,utm_campaign,device_class,country,region) VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, clipped(request.headers.get("referer"), 500), clipped(url.searchParams.get("campaign"), 120), clipped(url.searchParams.get("utm_source"), 120), clipped(url.searchParams.get("utm_medium"), 120), clipped(url.searchParams.get("utm_campaign"), 120), /mobile/i.test(ua) ? "mobile" : "desktop", clipped(request.headers.get("cf-ipcountry"), 4), clipped(request.headers.get("cf-region"), 120)).run();
  await recordEvent(env.DB, "official_apply_click", id, { utmSource: url.searchParams.get("utm_source") });
  return new Response(null, { status: 302, headers: { location: row.application_url, "cache-control": "no-store", "referrer-policy": "strict-origin-when-cross-origin" } });
}

async function adminApi(request, db, path) {
  if (request.method === "POST" && path === "/api/admin/bootstrap") return bootstrapAdmin(request, db);
  const admin = await requireAdmin(request, db);
  if (!admin) return json({ error: "Editorial access requires an authorized signed-in account." }, 401);
  if (request.method === "GET" && path === "/api/admin/me") return json({ id: admin.id, email: admin.email, role: admin.role });
  if (request.method === "GET" && path === "/api/admin/opportunities") {
    const result = await db.prepare(`SELECT o.*,p.name provider,c.name category FROM opportunities o JOIN providers p ON p.id=o.provider_id JOIN categories c ON c.id=o.category_id ORDER BY o.updated_at DESC`).all();
    return json({ opportunities: result.results.map(adminRow) });
  }
  if (request.method === "POST" && path === "/api/admin/opportunities") return createOpportunity(request, db, admin);
  const match = path.match(/^\/api\/admin\/opportunities\/(\d+)(?:\/(verify|publish))?$/);
  if (match && request.method === "PUT" && !match[2]) return updateOpportunity(request, db, admin, Number(match[1]));
  if (match && request.method === "POST" && match[2] === "verify") return verifyOpportunity(request, db, admin, Number(match[1]));
  if (match && request.method === "POST" && match[2] === "publish") return publishOpportunity(db, admin, Number(match[1]));
  if (request.method === "GET" && path === "/api/admin/analytics") {
    const events = await db.prepare(`SELECT event_name,count(*) total FROM analytics_events GROUP BY event_name ORDER BY total DESC`).all();
    const clicks = await db.prepare(`SELECT o.title,count(c.id) clicks FROM opportunities o LEFT JOIN outbound_clicks c ON c.opportunity_id=o.id GROUP BY o.id ORDER BY clicks DESC LIMIT 20`).all();
    return json({ events: events.results, outboundClicks: clicks.results });
  }
  return json({ error: "Not found" }, 404);
}

async function bootstrapAdmin(request, db) {
  const identity = identityFrom(request);
  if (!identity) return json({ error: "Sign in to the private Site before activating editorial access." }, 401);
  const count = await db.prepare(`SELECT count(*) total FROM users WHERE role IN ('super_admin','editor','verifier')`).first();
  if (Number(count?.total) > 0) return json({ error: "Editorial access is already initialized." }, 409);
  const inserted = await db.prepare(`INSERT INTO users (external_user_id,email,role,display_name) VALUES (?,?, 'super_admin',?)`).bind(identity.id, identity.email, identity.name).run();
  const id = Number(inserted.meta.last_row_id);
  await audit(db, id, "bootstrap_admin", "user", id, {});
  return json({ id, email: identity.email, role: "super_admin" }, 201);
}

async function requireAdmin(request, db) {
  const identity = identityFrom(request);
  if (!identity) return null;
  return db.prepare(`SELECT id,email,role FROM users WHERE external_user_id=? AND role IN ('super_admin','editor','verifier') LIMIT 1`).bind(identity.id).first();
}

async function createOpportunity(request, db, admin) {
  const b = await bodyJson(request);
  const title = String(b.title || "").trim().slice(0, 180), providerName = String(b.provider || "").trim().slice(0, 180), categoryName = String(b.category || "").trim().slice(0, 80), officialDomain = normalDomain(b.officialDomain);
  if (!title || !providerName || !categoryName || !officialDomain || !b.summary || !b.officialSourceUrl || !b.applicationUrl) return json({ error: "Title, provider, category, summary, source and application URL are required." }, 400);
  if (!isSafeOfficialUrl(b.officialSourceUrl, officialDomain) || !isSafeOfficialUrl(b.applicationUrl, officialDomain)) return json({ error: "Source and application URLs must be HTTPS destinations on the official domain or its subdomains." }, 400);
  const providerSlug = slugify(providerName), categorySlug = slugify(categoryName), slug = `${slugify(title)}-${Date.now().toString(36).slice(-4)}`;
  await db.prepare(`INSERT OR IGNORE INTO providers (name,slug,official_domain) VALUES (?,?,?)`).bind(providerName, providerSlug, officialDomain).run();
  await db.prepare(`INSERT OR IGNORE INTO categories (name,slug) VALUES (?,?)`).bind(categoryName, categorySlug).run();
  const provider = await db.prepare(`SELECT id FROM providers WHERE slug=?`).bind(providerSlug).first();
  const category = await db.prepare(`SELECT id FROM categories WHERE slug=?`).bind(categorySlug).first();
  const inserted = await db.prepare(`INSERT INTO opportunities (slug,title,provider_id,category_id,summary,benefit,eligibility_json,requirements_json,location,opening_date,deadline,official_source_url,application_url,official_domain,editorial_status,verification_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'draft','unverified')`).bind(slug, title, provider.id, category.id, String(b.summary).trim().slice(0, 4000), clipped(b.benefit, 500), JSON.stringify(parseJsonList(b.eligibility)), JSON.stringify(parseJsonList(b.requirements)), clipped(b.location, 180) || "Nigeria", b.openingDate || null, b.deadline || null, b.officialSourceUrl, b.applicationUrl, officialDomain).run();
  const id = Number(inserted.meta.last_row_id);
  await db.batch([db.prepare(`INSERT INTO sources (opportunity_id,url,source_class) VALUES (?,?, 'tier_a')`).bind(id, b.officialSourceUrl), db.prepare(`INSERT INTO opportunity_revisions (opportunity_id,editor_id,revision_json,reason) VALUES (?,?,?, 'created')`).bind(id, admin.id, JSON.stringify(b)), db.prepare(`INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,metadata_json) VALUES (?, 'create','opportunity',?, '{}')`).bind(admin.id, String(id))]);
  return json({ id, slug, editorialStatus: "draft" }, 201);
}

async function updateOpportunity(request, db, admin, id) {
  const b = await bodyJson(request);
  const allowed = ["draft", "awaiting_verification", "retracted"];
  if (!allowed.includes(b.editorialStatus)) return json({ error: "Unsupported editorial transition." }, 400);
  const current = await db.prepare(`SELECT id,editorial_status FROM opportunities WHERE id=?`).bind(id).first();
  if (!current) return json({ error: "Opportunity not found" }, 404);
  await db.batch([db.prepare(`UPDATE opportunities SET editorial_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(b.editorialStatus, id), db.prepare(`INSERT INTO opportunity_revisions (opportunity_id,editor_id,revision_json,reason) VALUES (?,?,?, 'status_change')`).bind(id, admin.id, JSON.stringify({ from: current.editorial_status, to: b.editorialStatus })), db.prepare(`INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,metadata_json) VALUES (?, 'status_change','opportunity',?,?)`).bind(admin.id, String(id), JSON.stringify({ from: current.editorial_status, to: b.editorialStatus }))]);
  return json({ ok: true, editorialStatus: b.editorialStatus });
}

async function verifyOpportunity(request, db, admin, id) {
  const b = await bodyJson(request);
  const row = await db.prepare(`SELECT o.*,p.name provider FROM opportunities o JOIN providers p ON p.id=o.provider_id WHERE o.id=?`).bind(id).first();
  if (!row) return json({ error: "Opportunity not found" }, 404);
  if (!isSafeOfficialUrl(b.primarySourceUrl, row.official_domain) || !isSafeOfficialUrl(b.applicationUrl, row.official_domain)) return json({ error: "Verification URLs do not match the stored official domain." }, 400);
  const score = Math.max(0, Math.min(100, Number(b.score) || 0));
  if (score < 70 || !b.deadlineConfirmed) return json({ error: "Human verification requires a score of at least 70 and a confirmed deadline." }, 422);
  await db.batch([db.prepare(`INSERT INTO verification_records (opportunity_id,reviewer_id,primary_source_url,application_url,programme_owner,official_domain,deadline_confirmed,score,notes) VALUES (?,?,?,?,?,?,1,?,?)`).bind(id, admin.id, b.primarySourceUrl, b.applicationUrl, clipped(b.programmeOwner, 180) || row.provider, row.official_domain, score, clipped(b.notes, 2000)), db.prepare(`UPDATE opportunities SET editorial_status='approved',verification_status='verified',verified_at=CURRENT_TIMESTAMP,verified_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(admin.id, id), db.prepare(`INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,metadata_json) VALUES (?, 'verify','opportunity',?,?)`).bind(admin.id, String(id), JSON.stringify({ score }))]);
  return json({ ok: true, editorialStatus: "approved", verificationStatus: "verified" });
}

async function publishOpportunity(db, admin, id) {
  const o = await db.prepare(`SELECT id,editorial_status,official_source_url,application_url,official_domain FROM opportunities WHERE id=?`).bind(id).first();
  const v = await db.prepare(`SELECT reviewer_id,primary_source_url,programme_owner,deadline_confirmed,score FROM verification_records WHERE opportunity_id=? ORDER BY reviewed_at DESC LIMIT 1`).bind(id).first();
  const opportunity = o && { editorialStatus: o.editorial_status, officialSourceUrl: o.official_source_url, applicationUrl: o.application_url, officialDomain: o.official_domain };
  const evidence = v && { reviewerId: v.reviewer_id, primarySourceUrl: v.primary_source_url, programmeOwner: v.programme_owner, deadlineConfirmed: Boolean(v.deadline_confirmed), score: v.score };
  if (!verificationCanPublish(opportunity, evidence)) return json({ error: "Publication is blocked until complete human verification is recorded." }, 422);
  await db.batch([db.prepare(`UPDATE opportunities SET editorial_status='published',published_at=COALESCE(published_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id), db.prepare(`INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,metadata_json) VALUES (?, 'publish','opportunity',?, '{}')`).bind(admin.id, String(id))]);
  return json({ ok: true, editorialStatus: "published" });
}

async function publicPage(env, url) {
  let title = "OpportunityNG — Verified opportunities, original sources";
  let description = "Discover verified grants, training, scholarships, jobs and funding opportunities—and apply directly with the programme owner.";
  let structured = "";
  if (url.pathname.startsWith("/opportunities/")) {
    const slug = decodeURIComponent(url.pathname.slice("/opportunities/".length));
    const item = await publicOpportunity(env.DB, slug);
    if (!item) return response("Opportunity not found", 404);
    title = `${item.title} — OpportunityNG`;
    description = item.summary;
    structured = `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: item.title, description: item.summary, datePublished: item.verified, author: { "@type": "Organization", name: "OpportunityNG" }, publisher: { "@type": "Organization", name: "OpportunityNG" }, mainEntityOfPage: url.href })}</script>`;
  }
  const canonical = `<link rel="canonical" href="${escapeHtml(url.origin + url.pathname)}"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">${structured}`;
  let page = PUBLIC_HTML.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`).replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`).replace("</head>", `${canonical}</head>`);
  return html(page, { "cache-control": "public, max-age=60" });
}

async function sitemap(env, url) {
  const rows = await env.DB.prepare(`SELECT slug,updated_at FROM opportunities WHERE editorial_status='published' AND verification_status IN ('verified','partner_verified') ORDER BY updated_at DESC`).all();
  const pages = ["/", ...Object.keys(POLICY_PAGES), "/report-an-opportunity", "/submit-an-opportunity", ...rows.results.map((r) => `/opportunities/${encodeURIComponent(r.slug)}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map((path) => `<url><loc>${escapeHtml(url.origin + path)}</loc></url>`).join("")}</urlset>`;
  return response(xml, 200, { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" });
}

function contentPage(title, copy) { return basePage(title, `<main><p class="kicker">OPPORTUNITYNG TRUST CENTRE</p><h1>${escapeHtml(title)}</h1><p class="lead">${escapeHtml(copy)}</p><div class="callout"><strong>Our standing promise</strong><p>Verified opportunities link to stored evidence and a genuine programme-owner destination. OpportunityNG never charges to reveal an official government application link.</p></div></main>`); }
function formPage(path) { const submit = path.includes("submit"); const title = submit ? "Submit an opportunity" : "Report incorrect information"; const type = submit ? "opportunity_submission" : "general"; return basePage(title, `<main><p class="kicker">COMMUNITY REVIEW</p><h1>${title}</h1><p class="lead">${submit ? "Share a legitimate programme for editorial review. Submission never guarantees publication." : "Tell our editorial team what needs checking. Reports are reviewed against the original source."}</p><form id="publicForm"><label>Email (optional)<input type="email" name="email"></label><label>Details<textarea name="message" required minlength="10"></textarea></label><button>Send to editorial team</button><p id="result"></p></form></main><script>document.getElementById('publicForm').onsubmit=async(e)=>{e.preventDefault();const d=Object.fromEntries(new FormData(e.target));d.reportType='${type}';const r=await fetch('/api/reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(d)});document.getElementById('result').textContent=r.ok?'Thank you. The editorial team will review this.':'Please check the form and try again.';if(r.ok)e.target.reset()}</script>`); }
function basePage(title, body) { return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — OpportunityNG</title><style>body{margin:0;background:#f7faf8;color:#11251f;font:16px/1.65 'Segoe UI',Arial,sans-serif}header,main,footer{width:min(820px,calc(100% - 32px));margin:auto}header{height:76px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #dce6e0}header a{color:#087a55;text-decoration:none;font-weight:800}main{padding:70px 0 100px}.kicker{color:#087a55;font-size:.75rem;letter-spacing:.12em;font-weight:900}h1{margin:6px 0 20px;font:500 clamp(2.8rem,6vw,5rem)/1 Georgia,serif;letter-spacing:-.05em}.lead{font-size:1.15rem;color:#52675e}.callout,form{margin-top:34px;padding:24px;border:1px solid #dce6e0;border-radius:14px;background:white}form{display:grid;gap:16px}label{display:grid;gap:6px;font-weight:700}input,textarea{padding:11px;border:1px solid #cbd9d0;border-radius:8px;font:inherit}textarea{min-height:150px}button{width:max-content;border:0;border-radius:8px;padding:12px 18px;background:#087a55;color:white;font-weight:800;cursor:pointer}footer{padding:25px 0;border-top:1px solid #dce6e0;color:#6d7e76;font-size:.8rem}</style></head><body><header><a href="/">OpportunityNG</a><a href="/">Back to opportunities</a></header>${body}<footer>Independent information platform · Not a government agency</footer></body></html>`; }

function adminRow(r) { return { id: r.id, slug: r.slug, title: r.title, provider: r.provider, category: r.category, summary: r.summary, benefit: r.benefit, eligibility: safeArray(r.eligibility_json), requirements: safeArray(r.requirements_json), location: r.location, openingDate: r.opening_date, deadline: r.deadline, editorialStatus: r.editorial_status, officialSourceUrl: r.official_source_url, applicationUrl: r.application_url, officialDomain: r.official_domain, verificationStatus: r.verification_status, updatedAt: r.updated_at }; }
function identityFrom(request) { const id = request.headers.get("oai-authenticated-user-id"), email = request.headers.get("oai-authenticated-user-email"); if (!id || !email) return null; let name = email; if (request.headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") { try { name = decodeURIComponent(request.headers.get("oai-authenticated-user-full-name") || email); } catch {} } return { id, email, name }; }
async function recordEvent(db, name, opportunityId, metadata) { if (!EVENTS.has(name)) return; await db.prepare(`INSERT INTO analytics_events (event_name,opportunity_id,metadata_json) VALUES (?,?,?)`).bind(name, opportunityId || null, JSON.stringify(sanitiseMetadata(metadata))).run(); }
async function audit(db, actorId, action, entityType, entityId, metadata) { await db.prepare(`INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,metadata_json) VALUES (?,?,?,?,?)`).bind(actorId || null, action, entityType, String(entityId || ""), JSON.stringify(sanitiseMetadata(metadata))).run(); }
function sanitiseMetadata(value) { const safe = {}; if (!value || typeof value !== "object") return safe; for (const [key, entry] of Object.entries(value).slice(0, 20)) if (/^[a-zA-Z0-9_]+$/.test(key) && ["string", "number", "boolean"].includes(typeof entry)) safe[key] = typeof entry === "string" ? entry.slice(0, 200) : entry; return safe; }
function safeArray(value) { try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed.map(String).slice(0, 30) : []; } catch { return []; } }
function normalDomain(value) { try { const raw = String(value || "").trim().toLowerCase(); return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname.replace(/^www\./, ""); } catch { return ""; } }
function formatDate(value) { if (!value) return "Not stated"; const d = new Date(value.length === 10 ? `${value}T12:00:00Z` : value); return Number.isNaN(d.getTime()) ? "Not stated" : new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(d); }
function clipped(value, max) { return value == null ? null : String(value).slice(0, max); }
async function sha256(value) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function bodyJson(request) { if (!request.headers.get("content-type")?.includes("application/json")) throw new Error("Expected JSON"); const body = await request.json(); if (!body || Array.isArray(body) || typeof body !== "object") throw new Error("Expected object"); return body; }
function decodeBase64(value) { const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0)); return new TextDecoder().decode(bytes); }
function escapeHtml(value) { return String(value || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function html(body, headers = {}) { return response(body, 200, { "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "referrer-policy": "strict-origin-when-cross-origin", "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'", ...headers }); }
function json(body, status = 200) { return response(JSON.stringify(body), status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }); }
function response(body, status = 200, headers = {}) { return new Response(body, { status, headers }); }

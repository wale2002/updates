import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
};

export const providers = sqliteTable("providers", {
  id: integer("id").primaryKey({ autoIncrement: true }), name: text("name").notNull(), slug: text("slug").notNull(), officialDomain: text("official_domain").notNull(), type: text("type").notNull().default("organisation"), verificationStatus: text("verification_status").notNull().default("unverified"), ...timestamps,
}, (table) => [uniqueIndex("idx_providers_slug").on(table.slug)]);

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }), name: text("name").notNull(), slug: text("slug").notNull(), ...timestamps,
}, (table) => [uniqueIndex("idx_categories_slug").on(table.slug)]);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }), externalUserId: text("external_user_id").notNull(), email: text("email").notNull(), role: text("role").notNull().default("editor"), displayName: text("display_name"), ...timestamps,
}, (table) => [uniqueIndex("idx_users_external_user_id").on(table.externalUserId), uniqueIndex("idx_users_email").on(table.email)]);

export const opportunities = sqliteTable("opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }), slug: text("slug").notNull(), title: text("title").notNull(), providerId: integer("provider_id").notNull().references(() => providers.id), categoryId: integer("category_id").notNull().references(() => categories.id), summary: text("summary").notNull(), benefit: text("benefit"), eligibilityJson: text("eligibility_json").notNull().default("[]"), requirementsJson: text("requirements_json").notNull().default("[]"), location: text("location").notNull().default("Nigeria"), openingDate: text("opening_date"), deadline: text("deadline"), editorialStatus: text("editorial_status").notNull().default("draft"), officialSourceUrl: text("official_source_url").notNull(), applicationUrl: text("application_url").notNull(), officialDomain: text("official_domain").notNull(), verificationStatus: text("verification_status").notNull().default("unverified"), verifiedAt: text("verified_at"), verifiedBy: integer("verified_by").references(() => users.id), publishedAt: text("published_at"), ...timestamps,
}, (table) => [uniqueIndex("idx_opportunities_slug").on(table.slug), index("idx_opportunities_publication").on(table.editorialStatus, table.verificationStatus, table.deadline), index("idx_opportunities_provider").on(table.providerId), index("idx_opportunities_category").on(table.categoryId)]);

export const sources = sqliteTable("sources", {
  id: integer("id").primaryKey({ autoIncrement: true }), opportunityId: integer("opportunity_id").notNull().references(() => opportunities.id), url: text("url").notNull(), sourceClass: text("source_class").notNull(), pageTitle: text("page_title"), capturedAt: text("captured_at").notNull().default("CURRENT_TIMESTAMP"), evidenceHash: text("evidence_hash"), ...timestamps,
}, (table) => [index("idx_sources_opportunity").on(table.opportunityId)]);

export const verificationRecords = sqliteTable("verification_records", {
  id: integer("id").primaryKey({ autoIncrement: true }), opportunityId: integer("opportunity_id").notNull().references(() => opportunities.id), reviewerId: integer("reviewer_id").notNull().references(() => users.id), primarySourceUrl: text("primary_source_url").notNull(), applicationUrl: text("application_url").notNull(), programmeOwner: text("programme_owner").notNull(), officialDomain: text("official_domain").notNull(), deadlineConfirmed: integer("deadline_confirmed", { mode: "boolean" }).notNull().default(false), score: integer("score").notNull().default(0), notes: text("notes"), evidenceSnapshotKey: text("evidence_snapshot_key"), reviewedAt: text("reviewed_at").notNull().default("CURRENT_TIMESTAMP"), ...timestamps,
}, (table) => [index("idx_verification_opportunity").on(table.opportunityId)]);

export const opportunityRevisions = sqliteTable("opportunity_revisions", {
  id: integer("id").primaryKey({ autoIncrement: true }), opportunityId: integer("opportunity_id").notNull().references(() => opportunities.id), editorId: integer("editor_id").notNull().references(() => users.id), revisionJson: text("revision_json").notNull(), reason: text("reason"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (table) => [index("idx_revisions_opportunity").on(table.opportunityId)]);

export const outboundClicks = sqliteTable("outbound_clicks", {
  id: integer("id").primaryKey({ autoIncrement: true }), opportunityId: integer("opportunity_id").notNull().references(() => opportunities.id), referrer: text("referrer"), campaign: text("campaign"), utmSource: text("utm_source"), utmMedium: text("utm_medium"), utmCampaign: text("utm_campaign"), deviceClass: text("device_class"), country: text("country"), region: text("region"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (table) => [index("idx_outbound_clicks_opportunity_date").on(table.opportunityId, table.createdAt)]);

export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  id: integer("id").primaryKey({ autoIncrement: true }), email: text("email").notNull(), categoriesJson: text("categories_json").notNull().default("[]"), status: text("status").notNull().default("pending"), verificationTokenHash: text("verification_token_hash"), verifiedAt: text("verified_at"), ...timestamps,
}, (table) => [uniqueIndex("idx_newsletter_email").on(table.email)]);

export const savedOpportunities = sqliteTable("saved_opportunities", {
  id: integer("id").primaryKey({ autoIncrement: true }), userId: integer("user_id").notNull().references(() => users.id), opportunityId: integer("opportunity_id").notNull().references(() => opportunities.id), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (table) => [uniqueIndex("idx_saved_user_opportunity").on(table.userId, table.opportunityId)]);

export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }), opportunityId: integer("opportunity_id").references(() => opportunities.id), reportType: text("report_type").notNull(), message: text("message").notNull(), reporterEmail: text("reporter_email"), status: text("status").notNull().default("open"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"), resolvedAt: text("resolved_at"), resolvedBy: integer("resolved_by").references(() => users.id),
}, (table) => [index("idx_reports_status").on(table.status, table.createdAt)]);

export const analyticsEvents = sqliteTable("analytics_events", {
  id: integer("id").primaryKey({ autoIncrement: true }), eventName: text("event_name").notNull(), opportunityId: integer("opportunity_id").references(() => opportunities.id), metadataJson: text("metadata_json").notNull().default("{}"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (table) => [index("idx_analytics_event_date").on(table.eventName, table.createdAt)]);

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }), actorId: integer("actor_id").references(() => users.id), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"), metadataJson: text("metadata_json").notNull().default("{}"), createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
}, (table) => [index("idx_audit_entity").on(table.entityType, table.entityId, table.createdAt)]);

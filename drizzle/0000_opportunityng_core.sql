PRAGMA foreign_keys = ON;
--> statement-breakpoint
CREATE TABLE `providers` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`name` text NOT NULL,`slug` text NOT NULL,`official_domain` text NOT NULL,`type` text DEFAULT 'organisation' NOT NULL,`verification_status` text DEFAULT 'unverified' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_providers_slug` ON `providers` (`slug`);
--> statement-breakpoint
CREATE TABLE `categories` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`name` text NOT NULL,`slug` text NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_slug` ON `categories` (`slug`);
--> statement-breakpoint
CREATE TABLE `users` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`external_user_id` text NOT NULL,`email` text NOT NULL,`role` text DEFAULT 'editor' NOT NULL,`display_name` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_external_user_id` ON `users` (`external_user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);
--> statement-breakpoint
CREATE TABLE `opportunities` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`slug` text NOT NULL,`title` text NOT NULL,`provider_id` integer NOT NULL,`category_id` integer NOT NULL,`summary` text NOT NULL,`benefit` text,`eligibility_json` text DEFAULT '[]' NOT NULL,`requirements_json` text DEFAULT '[]' NOT NULL,`location` text DEFAULT 'Nigeria' NOT NULL,`opening_date` text,`deadline` text,`editorial_status` text DEFAULT 'draft' NOT NULL,`official_source_url` text NOT NULL,`application_url` text NOT NULL,`official_domain` text NOT NULL,`verification_status` text DEFAULT 'unverified' NOT NULL,`verified_at` text,`verified_by` integer,`published_at` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`provider_id`) REFERENCES `providers`(`id`),FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_opportunities_slug` ON `opportunities` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_opportunities_publication` ON `opportunities` (`editorial_status`,`verification_status`,`deadline`);
--> statement-breakpoint
CREATE INDEX `idx_opportunities_provider` ON `opportunities` (`provider_id`);
--> statement-breakpoint
CREATE INDEX `idx_opportunities_category` ON `opportunities` (`category_id`);
--> statement-breakpoint
CREATE TABLE `sources` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`opportunity_id` integer NOT NULL,`url` text NOT NULL,`source_class` text NOT NULL,`page_title` text,`captured_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`evidence_hash` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_sources_opportunity` ON `sources` (`opportunity_id`);
--> statement-breakpoint
CREATE TABLE `verification_records` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`opportunity_id` integer NOT NULL,`reviewer_id` integer NOT NULL,`primary_source_url` text NOT NULL,`application_url` text NOT NULL,`programme_owner` text NOT NULL,`official_domain` text NOT NULL,`deadline_confirmed` integer DEFAULT 0 NOT NULL,`score` integer DEFAULT 0 NOT NULL,`notes` text,`evidence_snapshot_key` text,`reviewed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`),FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_verification_opportunity` ON `verification_records` (`opportunity_id`);
--> statement-breakpoint
CREATE TABLE `opportunity_revisions` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`opportunity_id` integer NOT NULL,`editor_id` integer NOT NULL,`revision_json` text NOT NULL,`reason` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`),FOREIGN KEY (`editor_id`) REFERENCES `users`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_revisions_opportunity` ON `opportunity_revisions` (`opportunity_id`);
--> statement-breakpoint
CREATE TABLE `outbound_clicks` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`opportunity_id` integer NOT NULL,`referrer` text,`campaign` text,`utm_source` text,`utm_medium` text,`utm_campaign` text,`device_class` text,`country` text,`region` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_outbound_clicks_opportunity_date` ON `outbound_clicks` (`opportunity_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `newsletter_subscribers` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`email` text NOT NULL,`categories_json` text DEFAULT '[]' NOT NULL,`status` text DEFAULT 'pending' NOT NULL,`verification_token_hash` text,`verified_at` text,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_newsletter_email` ON `newsletter_subscribers` (`email`);
--> statement-breakpoint
CREATE TABLE `saved_opportunities` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`user_id` integer NOT NULL,`opportunity_id` integer NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`));
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_saved_user_opportunity` ON `saved_opportunities` (`user_id`,`opportunity_id`);
--> statement-breakpoint
CREATE TABLE `reports` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`opportunity_id` integer,`report_type` text NOT NULL,`message` text NOT NULL,`reporter_email` text,`status` text DEFAULT 'open' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,`resolved_at` text,`resolved_by` integer,FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`),FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_reports_status` ON `reports` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `analytics_events` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`event_name` text NOT NULL,`opportunity_id` integer,`metadata_json` text DEFAULT '{}' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_analytics_event_date` ON `analytics_events` (`event_name`,`created_at`);
--> statement-breakpoint
CREATE TABLE `audit_logs` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`actor_id` integer,`action` text NOT NULL,`entity_type` text NOT NULL,`entity_id` text,`metadata_json` text DEFAULT '{}' NOT NULL,`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`));
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);
--> statement-breakpoint
PRAGMA optimize;

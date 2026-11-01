import { sql } from '@payloadcms/db-sqlite'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`accounts\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`email\` text NOT NULL,
    \`password_hash\` text,
    \`first_name\` text,
    \`last_name\` text,
    \`role\` text DEFAULT 'USER' NOT NULL,
    \`is_blocked\` integer DEFAULT false,
    \`avatar\` text,
    \`avatar_media_id\` text(36),
    \`mfa_secret\` text,
    \`mfa_pending_secret\` text,
    \`mfa_pending_created_at\` text,
    \`mfa_enabled_at\` text,
    \`web_authn_registration_challenge\` text,
    \`web_authn_registration_challenge_exp\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`avatar_media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`accounts_email_idx\` ON \`accounts\` (\`email\`);`)
  await db.run(sql`CREATE INDEX \`accounts_avatar_media_idx\` ON \`accounts\` (\`avatar_media_id\`);`)
  await db.run(sql`CREATE INDEX \`accounts_updated_at_idx\` ON \`accounts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`accounts_created_at_idx\` ON \`accounts\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`services_includes\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text(36) NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`value\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_includes_order_idx\` ON \`services_includes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_includes_parent_id_idx\` ON \`services_includes\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`services_shapes\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text(36) NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`value\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_shapes_order_idx\` ON \`services_shapes\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_shapes_parent_id_idx\` ON \`services_shapes\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`services_option_groups_options\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`label\` text NOT NULL,
    \`price_delta\` numeric DEFAULT 0 NOT NULL,
    \`price_factor\` numeric DEFAULT 1 NOT NULL,
    \`is_default\` integer DEFAULT false,
    \`sort_order\` numeric DEFAULT 0 NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`services_option_groups\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_option_groups_options_order_idx\` ON \`services_option_groups_options\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_option_groups_options_parent_id_idx\` ON \`services_option_groups_options\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`services_option_groups\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text(36) NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`required\` integer DEFAULT true,
    \`sort_order\` numeric DEFAULT 0 NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`services_option_groups_order_idx\` ON \`services_option_groups\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`services_option_groups_parent_id_idx\` ON \`services_option_groups\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`services\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`title\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`category\` text NOT NULL,
    \`short_desc\` text NOT NULL,
    \`full_desc\` text NOT NULL,
    \`result_text\` text NOT NULL,
    \`cover_image\` text,
    \`cover_id\` text(36),
    \`base_price\` numeric DEFAULT 0 NOT NULL,
    \`price_type\` text DEFAULT 'quote' NOT NULL,
    \`currency\` text DEFAULT 'RUB' NOT NULL,
    \`is_orderable\` integer DEFAULT false,
    \`is_published\` integer DEFAULT false,
    \`is_active\` integer DEFAULT true,
    \`sort_order\` numeric DEFAULT 0 NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`services_slug_idx\` ON \`services\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`services_cover_idx\` ON \`services\` (\`cover_id\`);`)
  await db.run(sql`CREATE INDEX \`services_updated_at_idx\` ON \`services\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`services_created_at_idx\` ON \`services\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`products\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`name\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`description\` text,
    \`price\` numeric NOT NULL,
    \`cover_image\` text,
    \`cover_id\` text(36),
    \`category\` text,
    \`is_active\` integer DEFAULT true,
    \`stock\` numeric DEFAULT 0 NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`products_slug_idx\` ON \`products\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`products_cover_idx\` ON \`products\` (\`cover_id\`);`)
  await db.run(sql`CREATE INDEX \`products_updated_at_idx\` ON \`products\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`products_created_at_idx\` ON \`products\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`posts\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`title\` text NOT NULL,
    \`slug\` text NOT NULL,
    \`excerpt\` text NOT NULL,
    \`content\` text NOT NULL,
    \`cover_image\` text,
    \`cover_id\` text(36),
    \`images\` text,
    \`read_time\` numeric DEFAULT 5 NOT NULL,
    \`source\` text DEFAULT 'manual' NOT NULL,
    \`source_url\` text,
    \`is_featured\` integer DEFAULT false,
    \`is_published\` integer DEFAULT false,
    \`published_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`cover_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`posts_slug_idx\` ON \`posts\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`posts_cover_idx\` ON \`posts\` (\`cover_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_updated_at_idx\` ON \`posts\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`posts_created_at_idx\` ON \`posts\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`posts_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` text(36) NOT NULL,
    \`path\` text NOT NULL,
    \`media_id\` text(36),
    FOREIGN KEY (\`parent_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`posts_rels_order_idx\` ON \`posts_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_parent_idx\` ON \`posts_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_path_idx\` ON \`posts_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`posts_rels_media_id_idx\` ON \`posts_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE TABLE \`media\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`alt\` text NOT NULL,
    \`kind\` text DEFAULT 'general' NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`url\` text,
    \`thumbnail_u_r_l\` text,
    \`filename\` text,
    \`mime_type\` text,
    \`filesize\` numeric,
    \`width\` numeric,
    \`height\` numeric,
    \`focal_x\` numeric,
    \`focal_y\` numeric
  );
  `)
  await db.run(sql`CREATE INDEX \`media_updated_at_idx\` ON \`media\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`media_created_at_idx\` ON \`media\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`media_filename_idx\` ON \`media\` (\`filename\`);`)
  await db.run(sql`CREATE TABLE \`orders\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`order_number\` text,
    \`number\` text,
    \`user_id_id\` text(36) NOT NULL,
    \`cart_key\` text,
    \`status\` text DEFAULT 'cart' NOT NULL,
    \`estimated_amount\` numeric DEFAULT 0 NOT NULL,
    \`subtotal\` numeric DEFAULT 0 NOT NULL,
    \`discount\` numeric DEFAULT 0 NOT NULL,
    \`total\` numeric DEFAULT 0 NOT NULL,
    \`currency\` text DEFAULT 'RUB' NOT NULL,
    \`deadline\` text,
    \`description\` text,
    \`final_price\` numeric,
    \`customer_note\` text,
    \`manager_note\` text,
    \`manager_id_id\` text(36),
    \`price_agreed_at\` text,
    \`is_locked\` integer DEFAULT false,
    \`locked_at\` text,
    \`locked_by_id_id\` text(36),
    \`paid_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`user_id_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`manager_id_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`locked_by_id_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_order_number_idx\` ON \`orders\` (\`order_number\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_number_idx\` ON \`orders\` (\`number\`);`)
  await db.run(sql`CREATE INDEX \`orders_user_id_idx\` ON \`orders\` (\`user_id_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`orders_cart_key_idx\` ON \`orders\` (\`cart_key\`);`)
  await db.run(sql`CREATE INDEX \`orders_manager_id_idx\` ON \`orders\` (\`manager_id_id\`);`)
  await db.run(sql`CREATE INDEX \`orders_locked_by_id_idx\` ON \`orders\` (\`locked_by_id_id\`);`)
  await db.run(sql`CREATE INDEX \`orders_updated_at_idx\` ON \`orders\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`orders_created_at_idx\` ON \`orders\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`order_services\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`order_id_id\` text(36) NOT NULL,
    \`service_id_id\` text(36) NOT NULL,
    \`service_key\` text,
    \`quantity\` numeric DEFAULT 1 NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`order_id_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`service_id_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`order_services_order_id_idx\` ON \`order_services\` (\`order_id_id\`);`)
  await db.run(sql`CREATE INDEX \`order_services_service_id_idx\` ON \`order_services\` (\`service_id_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`order_services_service_key_idx\` ON \`order_services\` (\`service_key\`);`)
  await db.run(sql`CREATE INDEX \`order_services_updated_at_idx\` ON \`order_services\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`order_services_created_at_idx\` ON \`order_services\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`order_items\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`order_id_id\` text(36) NOT NULL,
    \`item_type\` text DEFAULT 'service' NOT NULL,
    \`item_id\` text DEFAULT '' NOT NULL,
    \`service_id_id\` text(36),
    \`product_id_id\` text(36),
    \`title\` text DEFAULT '' NOT NULL,
    \`quantity\` numeric DEFAULT 1 NOT NULL,
    \`estimated_unit_price\` numeric DEFAULT 0 NOT NULL,
    \`unit_price\` numeric DEFAULT 0 NOT NULL,
    \`total_price\` numeric DEFAULT 0 NOT NULL,
    \`options_snapshot\` text DEFAULT '[]' NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`order_id_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`service_id_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (\`product_id_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`order_items_order_id_idx\` ON \`order_items\` (\`order_id_id\`);`)
  await db.run(sql`CREATE INDEX \`order_items_service_id_idx\` ON \`order_items\` (\`service_id_id\`);`)
  await db.run(sql`CREATE INDEX \`order_items_product_id_idx\` ON \`order_items\` (\`product_id_id\`);`)
  await db.run(sql`CREATE INDEX \`order_items_updated_at_idx\` ON \`order_items\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`order_items_created_at_idx\` ON \`order_items\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payments\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`order_id_id\` text(36) NOT NULL,
    \`provider\` text NOT NULL,
    \`external_id\` text,
    \`provider_key\` text,
    \`status\` text DEFAULT 'pending' NOT NULL,
    \`amount\` numeric NOT NULL,
    \`currency\` text DEFAULT 'RUB' NOT NULL,
    \`payment_url\` text,
    \`raw_payload\` text,
    \`paid_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`order_id_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`payments_order_id_idx\` ON \`payments\` (\`order_id_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`payments_provider_key_idx\` ON \`payments\` (\`provider_key\`);`)
  await db.run(sql`CREATE INDEX \`payments_updated_at_idx\` ON \`payments\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payments_created_at_idx\` ON \`payments\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`activity_logs\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`action\` text NOT NULL,
    \`entity_type\` text NOT NULL,
    \`entity_id\` text NOT NULL,
    \`title\` text NOT NULL,
    \`actor_id_id\` text(36),
    \`actor_pseudonym\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`actor_id_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`activity_logs_actor_id_idx\` ON \`activity_logs\` (\`actor_id_id\`);`)
  await db.run(sql`CREATE INDEX \`activity_logs_updated_at_idx\` ON \`activity_logs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`activity_logs_created_at_idx\` ON \`activity_logs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`page_views\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`path\` text NOT NULL,
    \`session_id\` text,
    \`visitor_id\` text,
    \`referrer\` text,
    \`utm_source\` text,
    \`user_agent\` text,
    \`device\` text,
    \`duration_ms\` numeric,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`page_views_path_idx\` ON \`page_views\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`page_views_session_id_idx\` ON \`page_views\` (\`session_id\`);`)
  await db.run(sql`CREATE INDEX \`page_views_visitor_id_idx\` ON \`page_views\` (\`visitor_id\`);`)
  await db.run(sql`CREATE INDEX \`page_views_updated_at_idx\` ON \`page_views\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`page_views_created_at_idx\` ON \`page_views\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`site_settings\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`key\` text NOT NULL,
    \`value\` text NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`site_settings_key_idx\` ON \`site_settings\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_updated_at_idx\` ON \`site_settings\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`site_settings_created_at_idx\` ON \`site_settings\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`pending_logins\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`user_id_id\` text(36) NOT NULL,
    \`role\` text DEFAULT 'USER' NOT NULL,
    \`secret_hash\` text NOT NULL,
    \`web_authn_challenge\` text,
    \`attempts\` numeric DEFAULT 0 NOT NULL,
    \`expires_at\` text NOT NULL,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`user_id_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`pending_logins_user_id_idx\` ON \`pending_logins\` (\`user_id_id\`);`)
  await db.run(sql`CREATE INDEX \`pending_logins_expires_at_idx\` ON \`pending_logins\` (\`expires_at\`);`)
  await db.run(sql`CREATE INDEX \`pending_logins_updated_at_idx\` ON \`pending_logins\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`pending_logins_created_at_idx\` ON \`pending_logins\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`auth_sessions\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`user_id_id\` text(36) NOT NULL,
    \`refresh_hash\` text NOT NULL,
    \`device_hash\` text NOT NULL,
    \`role\` text DEFAULT 'USER' NOT NULL,
    \`last_used_at\` text NOT NULL,
    \`expires_at\` text NOT NULL,
    \`revoked_at\` text,
    \`revoke_reason\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`user_id_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`auth_sessions_user_id_idx\` ON \`auth_sessions\` (\`user_id_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`auth_sessions_refresh_hash_idx\` ON \`auth_sessions\` (\`refresh_hash\`);`)
  await db.run(sql`CREATE INDEX \`auth_sessions_expires_at_idx\` ON \`auth_sessions\` (\`expires_at\`);`)
  await db.run(sql`CREATE INDEX \`auth_sessions_revoked_at_idx\` ON \`auth_sessions\` (\`revoked_at\`);`)
  await db.run(sql`CREATE INDEX \`auth_sessions_updated_at_idx\` ON \`auth_sessions\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`auth_sessions_created_at_idx\` ON \`auth_sessions\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`mfa_backup_codes\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`user_id_id\` text(36) NOT NULL,
    \`code_hash\` text NOT NULL,
    \`used_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`user_id_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`mfa_backup_codes_user_id_idx\` ON \`mfa_backup_codes\` (\`user_id_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`mfa_backup_codes_code_hash_idx\` ON \`mfa_backup_codes\` (\`code_hash\`);`)
  await db.run(sql`CREATE INDEX \`mfa_backup_codes_used_at_idx\` ON \`mfa_backup_codes\` (\`used_at\`);`)
  await db.run(sql`CREATE INDEX \`mfa_backup_codes_updated_at_idx\` ON \`mfa_backup_codes\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`mfa_backup_codes_created_at_idx\` ON \`mfa_backup_codes\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`webauthn_credentials\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`user_id_id\` text(36) NOT NULL,
    \`public_key\` text NOT NULL,
    \`counter\` text DEFAULT '0' NOT NULL,
    \`transports\` text DEFAULT '[]' NOT NULL,
    \`name\` text DEFAULT 'Passkey' NOT NULL,
    \`last_used_at\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (\`user_id_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`webauthn_credentials_user_id_idx\` ON \`webauthn_credentials\` (\`user_id_id\`);`)
  await db.run(sql`CREATE INDEX \`webauthn_credentials_updated_at_idx\` ON \`webauthn_credentials\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`webauthn_credentials_created_at_idx\` ON \`webauthn_credentials\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`key\` text NOT NULL,
    \`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`global_slug\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` text(36) NOT NULL,
    \`path\` text NOT NULL,
    \`accounts_id\` text(36),
    \`services_id\` text(36),
    \`products_id\` text(36),
    \`posts_id\` text(36),
    \`media_id\` text(36),
    \`orders_id\` text(36),
    \`order_services_id\` text(36),
    \`order_items_id\` text(36),
    \`payments_id\` text(36),
    \`activity_logs_id\` text(36),
    \`page_views_id\` text(36),
    \`site_settings_id\` text(36),
    \`pending_logins_id\` text(36),
    \`auth_sessions_id\` text(36),
    \`mfa_backup_codes_id\` text(36),
    \`webauthn_credentials_id\` text(36),
    FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`accounts_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`services_id\`) REFERENCES \`services\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`products_id\`) REFERENCES \`products\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`posts_id\`) REFERENCES \`posts\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`orders_id\`) REFERENCES \`orders\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`order_services_id\`) REFERENCES \`order_services\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`order_items_id\`) REFERENCES \`order_items\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`payments_id\`) REFERENCES \`payments\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`activity_logs_id\`) REFERENCES \`activity_logs\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`page_views_id\`) REFERENCES \`page_views\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`site_settings_id\`) REFERENCES \`site_settings\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`pending_logins_id\`) REFERENCES \`pending_logins\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`auth_sessions_id\`) REFERENCES \`auth_sessions\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`mfa_backup_codes_id\`) REFERENCES \`mfa_backup_codes\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`webauthn_credentials_id\`) REFERENCES \`webauthn_credentials\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_accounts_id_idx\` ON \`payload_locked_documents_rels\` (\`accounts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_services_id_idx\` ON \`payload_locked_documents_rels\` (\`services_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_products_id_idx\` ON \`payload_locked_documents_rels\` (\`products_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_posts_id_idx\` ON \`payload_locked_documents_rels\` (\`posts_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_orders_id_idx\` ON \`payload_locked_documents_rels\` (\`orders_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_services_id_idx\` ON \`payload_locked_documents_rels\` (\`order_services_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_items_id_idx\` ON \`payload_locked_documents_rels\` (\`order_items_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payments_id_idx\` ON \`payload_locked_documents_rels\` (\`payments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_activity_logs_id_idx\` ON \`payload_locked_documents_rels\` (\`activity_logs_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_page_views_id_idx\` ON \`payload_locked_documents_rels\` (\`page_views_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_site_settings_id_idx\` ON \`payload_locked_documents_rels\` (\`site_settings_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_pending_logins_id_idx\` ON \`payload_locked_documents_rels\` (\`pending_logins_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_auth_sessions_id_idx\` ON \`payload_locked_documents_rels\` (\`auth_sessions_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_mfa_backup_codes_id_idx\` ON \`payload_locked_documents_rels\` (\`mfa_backup_codes_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_webauthn_credentials_id_idx\` ON \`payload_locked_documents_rels\` (\`webauthn_credentials_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`key\` text,
    \`value\` text,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
    \`id\` integer PRIMARY KEY NOT NULL,
    \`order\` integer,
    \`parent_id\` text(36) NOT NULL,
    \`path\` text NOT NULL,
    \`accounts_id\` text(36),
    FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (\`accounts_id\`) REFERENCES \`accounts\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_accounts_id_idx\` ON \`payload_preferences_rels\` (\`accounts_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`name\` text,
    \`batch\` numeric,
    \`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    \`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`story_events\` (
    \`_order\` integer NOT NULL,
    \`_parent_id\` text(36) NOT NULL,
    \`id\` text PRIMARY KEY NOT NULL,
    \`period\` text NOT NULL,
    \`title\` text NOT NULL,
    \`description\` text NOT NULL,
    FOREIGN KEY (\`_parent_id\`) REFERENCES \`story\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`story_events_order_idx\` ON \`story_events\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`story_events_parent_id_idx\` ON \`story_events\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`story\` (
    \`id\` text(36) PRIMARY KEY NOT NULL,
    \`heading\` text,
    \`description\` text,
    \`updated_at\` text,
    \`created_at\` text
  );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`accounts\`;`)
  await db.run(sql`DROP TABLE \`services_includes\`;`)
  await db.run(sql`DROP TABLE \`services_shapes\`;`)
  await db.run(sql`DROP TABLE \`services_option_groups_options\`;`)
  await db.run(sql`DROP TABLE \`services_option_groups\`;`)
  await db.run(sql`DROP TABLE \`services\`;`)
  await db.run(sql`DROP TABLE \`products\`;`)
  await db.run(sql`DROP TABLE \`posts\`;`)
  await db.run(sql`DROP TABLE \`posts_rels\`;`)
  await db.run(sql`DROP TABLE \`media\`;`)
  await db.run(sql`DROP TABLE \`orders\`;`)
  await db.run(sql`DROP TABLE \`order_services\`;`)
  await db.run(sql`DROP TABLE \`order_items\`;`)
  await db.run(sql`DROP TABLE \`payments\`;`)
  await db.run(sql`DROP TABLE \`activity_logs\`;`)
  await db.run(sql`DROP TABLE \`page_views\`;`)
  await db.run(sql`DROP TABLE \`site_settings\`;`)
  await db.run(sql`DROP TABLE \`pending_logins\`;`)
  await db.run(sql`DROP TABLE \`auth_sessions\`;`)
  await db.run(sql`DROP TABLE \`mfa_backup_codes\`;`)
  await db.run(sql`DROP TABLE \`webauthn_credentials\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`story_events\`;`)
  await db.run(sql`DROP TABLE \`story\`;`)
}

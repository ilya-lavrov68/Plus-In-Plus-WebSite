-- Схема базы Plus In Plus (SQLite/libSQL).
-- Источник правды для приложения: Payload как слой данных удалён, схема
-- живёт здесь и применяется скриптом scripts/db-migrate.cjs.
--
-- Файл сгенерирован из рабочей базы (sqlite_master) и должен обновляться
-- вместе с кодом. Все таблицы создаются идемпотентно.

-- table accounts
CREATE TABLE `accounts` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `email` text NOT NULL,
    `password_hash` text,
    `first_name` text,
    `last_name` text,
    `role` text DEFAULT 'USER' NOT NULL,
    `is_blocked` integer DEFAULT false,
    `avatar` text,
    `avatar_media_id` text(36),
    `mfa_secret` text,
    `mfa_pending_secret` text,
    `mfa_pending_created_at` text,
    `mfa_enabled_at` text,
    `web_authn_registration_challenge` text,
    `web_authn_registration_challenge_exp` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`avatar_media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table activity_logs
CREATE TABLE `activity_logs` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `action` text NOT NULL,
    `entity_type` text NOT NULL,
    `entity_id` text NOT NULL,
    `title` text NOT NULL,
    `actor_id_id` text(36),
    `actor_pseudonym` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`actor_id_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table auth_sessions
CREATE TABLE `auth_sessions` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `user_id_id` text(36) NOT NULL,
    `refresh_hash` text NOT NULL,
    `device_hash` text NOT NULL,
    `role` text DEFAULT 'USER' NOT NULL,
    `last_used_at` text NOT NULL,
    `expires_at` text NOT NULL,
    `revoked_at` text,
    `revoke_reason` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`user_id_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table media
CREATE TABLE `media` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `alt` text NOT NULL,
    `kind` text DEFAULT 'general' NOT NULL,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `url` text,
    `thumbnail_u_r_l` text,
    `filename` text,
    `mime_type` text,
    `filesize` numeric,
    `width` numeric,
    `height` numeric,
    `focal_x` numeric,
    `focal_y` numeric
  );
-- table mfa_backup_codes
CREATE TABLE `mfa_backup_codes` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `user_id_id` text(36) NOT NULL,
    `code_hash` text NOT NULL,
    `used_at` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`user_id_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table order_items
CREATE TABLE `order_items` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `order_id_id` text(36) NOT NULL,
    `item_type` text DEFAULT 'service' NOT NULL,
    `item_id` text DEFAULT '' NOT NULL,
    `service_id_id` text(36),
    `product_id_id` text(36),
    `title` text DEFAULT '' NOT NULL,
    `quantity` numeric DEFAULT 1 NOT NULL,
    `estimated_unit_price` numeric DEFAULT 0 NOT NULL,
    `unit_price` numeric DEFAULT 0 NOT NULL,
    `total_price` numeric DEFAULT 0 NOT NULL,
    `options_snapshot` text DEFAULT '[]' NOT NULL,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`order_id_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (`service_id_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (`product_id_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table order_services
CREATE TABLE `order_services` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `order_id_id` text(36) NOT NULL,
    `service_id_id` text(36) NOT NULL,
    `service_key` text,
    `quantity` numeric DEFAULT 1 NOT NULL,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`order_id_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (`service_id_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table orders
CREATE TABLE `orders` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `order_number` text,
    `number` text,
    `user_id_id` text(36) NOT NULL,
    `cart_key` text,
    `status` text DEFAULT 'cart' NOT NULL,
    `estimated_amount` numeric DEFAULT 0 NOT NULL,
    `subtotal` numeric DEFAULT 0 NOT NULL,
    `discount` numeric DEFAULT 0 NOT NULL,
    `total` numeric DEFAULT 0 NOT NULL,
    `currency` text DEFAULT 'RUB' NOT NULL,
    `deadline` text,
    `description` text,
    `final_price` numeric,
    `customer_note` text,
    `manager_note` text,
    `manager_id_id` text(36),
    `price_agreed_at` text,
    `is_locked` integer DEFAULT false,
    `locked_at` text,
    `locked_by_id_id` text(36),
    `paid_at` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`user_id_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (`manager_id_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null,
    FOREIGN KEY (`locked_by_id_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table page_views
CREATE TABLE `page_views` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `path` text NOT NULL,
    `session_id` text,
    `visitor_id` text,
    `referrer` text,
    `utm_source` text,
    `user_agent` text,
    `device` text,
    `duration_ms` numeric,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
-- table payments
CREATE TABLE `payments` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `order_id_id` text(36) NOT NULL,
    `provider` text NOT NULL,
    `external_id` text,
    `provider_key` text,
    `status` text DEFAULT 'pending' NOT NULL,
    `amount` numeric NOT NULL,
    `currency` text DEFAULT 'RUB' NOT NULL,
    `payment_url` text,
    `raw_payload` text,
    `paid_at` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`order_id_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table pending_logins
CREATE TABLE `pending_logins` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `user_id_id` text(36) NOT NULL,
    `role` text DEFAULT 'USER' NOT NULL,
    `secret_hash` text NOT NULL,
    `web_authn_challenge` text,
    `attempts` numeric DEFAULT 0 NOT NULL,
    `expires_at` text NOT NULL,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`user_id_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table posts
CREATE TABLE `posts` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `title` text NOT NULL,
    `slug` text NOT NULL,
    `excerpt` text NOT NULL,
    `content` text NOT NULL,
    `cover_image` text,
    `cover_id` text(36),
    `images` text,
    `read_time` numeric DEFAULT 5 NOT NULL,
    `source` text DEFAULT 'manual' NOT NULL,
    `source_url` text,
    `is_featured` integer DEFAULT false,
    `is_published` integer DEFAULT false,
    `published_at` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`cover_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table posts_rels
CREATE TABLE `posts_rels` (
    `id` integer PRIMARY KEY NOT NULL,
    `order` integer,
    `parent_id` text(36) NOT NULL,
    `path` text NOT NULL,
    `media_id` text(36),
    FOREIGN KEY (`parent_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
  );
-- table products
CREATE TABLE `products` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `name` text NOT NULL,
    `slug` text NOT NULL,
    `description` text,
    `price` numeric NOT NULL,
    `cover_image` text,
    `cover_id` text(36),
    `category` text,
    `is_active` integer DEFAULT true,
    `stock` numeric DEFAULT 0 NOT NULL,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`cover_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table services
CREATE TABLE `services` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `title` text NOT NULL,
    `slug` text NOT NULL,
    `category` text NOT NULL,
    `short_desc` text NOT NULL,
    `full_desc` text NOT NULL,
    `result_text` text NOT NULL,
    `cover_image` text,
    `cover_id` text(36),
    `base_price` numeric DEFAULT 0 NOT NULL,
    `price_type` text DEFAULT 'quote' NOT NULL,
    `currency` text DEFAULT 'RUB' NOT NULL,
    `is_orderable` integer DEFAULT false,
    `is_published` integer DEFAULT false,
    `is_active` integer DEFAULT true,
    `sort_order` numeric DEFAULT 0 NOT NULL,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`cover_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE set null
  );
-- table services_includes
CREATE TABLE `services_includes` (
    `_order` integer NOT NULL,
    `_parent_id` text(36) NOT NULL,
    `id` text PRIMARY KEY NOT NULL,
    `value` text NOT NULL,
    FOREIGN KEY (`_parent_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
  );
-- table services_option_groups
CREATE TABLE `services_option_groups` (
    `_order` integer NOT NULL,
    `_parent_id` text(36) NOT NULL,
    `id` text PRIMARY KEY NOT NULL,
    `name` text NOT NULL,
    `required` integer DEFAULT true,
    `sort_order` numeric DEFAULT 0 NOT NULL,
    FOREIGN KEY (`_parent_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
  );
-- table services_option_groups_options
CREATE TABLE `services_option_groups_options` (
    `_order` integer NOT NULL,
    `_parent_id` text NOT NULL,
    `id` text PRIMARY KEY NOT NULL,
    `label` text NOT NULL,
    `price_delta` numeric DEFAULT 0 NOT NULL,
    `price_factor` numeric DEFAULT 1 NOT NULL,
    `is_default` integer DEFAULT false,
    `sort_order` numeric DEFAULT 0 NOT NULL,
    FOREIGN KEY (`_parent_id`) REFERENCES `services_option_groups`(`id`) ON UPDATE no action ON DELETE cascade
  );
-- table services_shapes
CREATE TABLE `services_shapes` (
    `_order` integer NOT NULL,
    `_parent_id` text(36) NOT NULL,
    `id` text PRIMARY KEY NOT NULL,
    `value` text NOT NULL,
    FOREIGN KEY (`_parent_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade
  );
-- table site_settings
CREATE TABLE `site_settings` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `key` text NOT NULL,
    `value` text NOT NULL,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
-- table story
CREATE TABLE `story` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `heading` text,
    `description` text,
    `updated_at` text,
    `created_at` text
  );
-- table story_events
CREATE TABLE `story_events` (
    `_order` integer NOT NULL,
    `_parent_id` text(36) NOT NULL,
    `id` text PRIMARY KEY NOT NULL,
    `period` text NOT NULL,
    `title` text NOT NULL,
    `description` text NOT NULL,
    FOREIGN KEY (`_parent_id`) REFERENCES `story`(`id`) ON UPDATE no action ON DELETE cascade
  );
-- table webauthn_credentials
CREATE TABLE `webauthn_credentials` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `user_id_id` text(36) NOT NULL,
    `public_key` text NOT NULL,
    `counter` text DEFAULT '0' NOT NULL,
    `transports` text DEFAULT '[]' NOT NULL,
    `name` text DEFAULT 'Passkey' NOT NULL,
    `last_used_at` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    FOREIGN KEY (`user_id_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
  );
-- index accounts_avatar_media_idx
CREATE INDEX `accounts_avatar_media_idx` ON `accounts` (`avatar_media_id`);
-- index accounts_created_at_idx
CREATE INDEX `accounts_created_at_idx` ON `accounts` (`created_at`);
-- index accounts_email_idx
CREATE UNIQUE INDEX `accounts_email_idx` ON `accounts` (`email`);
-- index accounts_updated_at_idx
CREATE INDEX `accounts_updated_at_idx` ON `accounts` (`updated_at`);
-- index activity_logs_actor_id_idx
CREATE INDEX `activity_logs_actor_id_idx` ON `activity_logs` (`actor_id_id`);
-- index activity_logs_created_at_idx
CREATE INDEX `activity_logs_created_at_idx` ON `activity_logs` (`created_at`);
-- index activity_logs_updated_at_idx
CREATE INDEX `activity_logs_updated_at_idx` ON `activity_logs` (`updated_at`);
-- index auth_sessions_created_at_idx
CREATE INDEX `auth_sessions_created_at_idx` ON `auth_sessions` (`created_at`);
-- index auth_sessions_expires_at_idx
CREATE INDEX `auth_sessions_expires_at_idx` ON `auth_sessions` (`expires_at`);
-- index auth_sessions_refresh_hash_idx
CREATE UNIQUE INDEX `auth_sessions_refresh_hash_idx` ON `auth_sessions` (`refresh_hash`);
-- index auth_sessions_revoked_at_idx
CREATE INDEX `auth_sessions_revoked_at_idx` ON `auth_sessions` (`revoked_at`);
-- index auth_sessions_updated_at_idx
CREATE INDEX `auth_sessions_updated_at_idx` ON `auth_sessions` (`updated_at`);
-- index auth_sessions_user_id_idx
CREATE INDEX `auth_sessions_user_id_idx` ON `auth_sessions` (`user_id_id`);
-- index media_created_at_idx
CREATE INDEX `media_created_at_idx` ON `media` (`created_at`);
-- index media_filename_idx
CREATE UNIQUE INDEX `media_filename_idx` ON `media` (`filename`);
-- index media_updated_at_idx
CREATE INDEX `media_updated_at_idx` ON `media` (`updated_at`);
-- index mfa_backup_codes_code_hash_idx
CREATE UNIQUE INDEX `mfa_backup_codes_code_hash_idx` ON `mfa_backup_codes` (`code_hash`);
-- index mfa_backup_codes_created_at_idx
CREATE INDEX `mfa_backup_codes_created_at_idx` ON `mfa_backup_codes` (`created_at`);
-- index mfa_backup_codes_updated_at_idx
CREATE INDEX `mfa_backup_codes_updated_at_idx` ON `mfa_backup_codes` (`updated_at`);
-- index mfa_backup_codes_used_at_idx
CREATE INDEX `mfa_backup_codes_used_at_idx` ON `mfa_backup_codes` (`used_at`);
-- index mfa_backup_codes_user_id_idx
CREATE INDEX `mfa_backup_codes_user_id_idx` ON `mfa_backup_codes` (`user_id_id`);
-- index order_items_created_at_idx
CREATE INDEX `order_items_created_at_idx` ON `order_items` (`created_at`);
-- index order_items_order_id_idx
CREATE INDEX `order_items_order_id_idx` ON `order_items` (`order_id_id`);
-- index order_items_product_id_idx
CREATE INDEX `order_items_product_id_idx` ON `order_items` (`product_id_id`);
-- index order_items_service_id_idx
CREATE INDEX `order_items_service_id_idx` ON `order_items` (`service_id_id`);
-- index order_items_updated_at_idx
CREATE INDEX `order_items_updated_at_idx` ON `order_items` (`updated_at`);
-- index order_services_created_at_idx
CREATE INDEX `order_services_created_at_idx` ON `order_services` (`created_at`);
-- index order_services_order_id_idx
CREATE INDEX `order_services_order_id_idx` ON `order_services` (`order_id_id`);
-- index order_services_service_id_idx
CREATE INDEX `order_services_service_id_idx` ON `order_services` (`service_id_id`);
-- index order_services_service_key_idx
CREATE UNIQUE INDEX `order_services_service_key_idx` ON `order_services` (`service_key`);
-- index order_services_updated_at_idx
CREATE INDEX `order_services_updated_at_idx` ON `order_services` (`updated_at`);
-- index orders_cart_key_idx
CREATE UNIQUE INDEX `orders_cart_key_idx` ON `orders` (`cart_key`);
-- index orders_created_at_idx
CREATE INDEX `orders_created_at_idx` ON `orders` (`created_at`);
-- index orders_locked_by_id_idx
CREATE INDEX `orders_locked_by_id_idx` ON `orders` (`locked_by_id_id`);
-- index orders_manager_id_idx
CREATE INDEX `orders_manager_id_idx` ON `orders` (`manager_id_id`);
-- index orders_number_idx
CREATE UNIQUE INDEX `orders_number_idx` ON `orders` (`number`);
-- index orders_order_number_idx
CREATE UNIQUE INDEX `orders_order_number_idx` ON `orders` (`order_number`);
-- index orders_updated_at_idx
CREATE INDEX `orders_updated_at_idx` ON `orders` (`updated_at`);
-- index orders_user_id_idx
CREATE INDEX `orders_user_id_idx` ON `orders` (`user_id_id`);
-- index page_views_created_at_idx
CREATE INDEX `page_views_created_at_idx` ON `page_views` (`created_at`);
-- index page_views_path_idx
CREATE INDEX `page_views_path_idx` ON `page_views` (`path`);
-- index page_views_session_id_idx
CREATE INDEX `page_views_session_id_idx` ON `page_views` (`session_id`);
-- index page_views_updated_at_idx
CREATE INDEX `page_views_updated_at_idx` ON `page_views` (`updated_at`);
-- index page_views_visitor_id_idx
CREATE INDEX `page_views_visitor_id_idx` ON `page_views` (`visitor_id`);
-- index payments_created_at_idx
CREATE INDEX `payments_created_at_idx` ON `payments` (`created_at`);
-- index payments_order_id_idx
CREATE INDEX `payments_order_id_idx` ON `payments` (`order_id_id`);
-- index payments_provider_key_idx
CREATE UNIQUE INDEX `payments_provider_key_idx` ON `payments` (`provider_key`);
-- index payments_updated_at_idx
CREATE INDEX `payments_updated_at_idx` ON `payments` (`updated_at`);
-- index pending_logins_created_at_idx
CREATE INDEX `pending_logins_created_at_idx` ON `pending_logins` (`created_at`);
-- index pending_logins_expires_at_idx
CREATE INDEX `pending_logins_expires_at_idx` ON `pending_logins` (`expires_at`);
-- index pending_logins_updated_at_idx
CREATE INDEX `pending_logins_updated_at_idx` ON `pending_logins` (`updated_at`);
-- index pending_logins_user_id_idx
CREATE INDEX `pending_logins_user_id_idx` ON `pending_logins` (`user_id_id`);
-- index posts_cover_idx
CREATE INDEX `posts_cover_idx` ON `posts` (`cover_id`);
-- index posts_created_at_idx
CREATE INDEX `posts_created_at_idx` ON `posts` (`created_at`);
-- index posts_rels_media_id_idx
CREATE INDEX `posts_rels_media_id_idx` ON `posts_rels` (`media_id`);
-- index posts_rels_order_idx
CREATE INDEX `posts_rels_order_idx` ON `posts_rels` (`order`);
-- index posts_rels_parent_idx
CREATE INDEX `posts_rels_parent_idx` ON `posts_rels` (`parent_id`);
-- index posts_rels_path_idx
CREATE INDEX `posts_rels_path_idx` ON `posts_rels` (`path`);
-- index posts_slug_idx
CREATE UNIQUE INDEX `posts_slug_idx` ON `posts` (`slug`);
-- index posts_updated_at_idx
CREATE INDEX `posts_updated_at_idx` ON `posts` (`updated_at`);
-- index products_cover_idx
CREATE INDEX `products_cover_idx` ON `products` (`cover_id`);
-- index products_created_at_idx
CREATE INDEX `products_created_at_idx` ON `products` (`created_at`);
-- index products_slug_idx
CREATE UNIQUE INDEX `products_slug_idx` ON `products` (`slug`);
-- index products_updated_at_idx
CREATE INDEX `products_updated_at_idx` ON `products` (`updated_at`);
-- index services_cover_idx
CREATE INDEX `services_cover_idx` ON `services` (`cover_id`);
-- index services_created_at_idx
CREATE INDEX `services_created_at_idx` ON `services` (`created_at`);
-- index services_includes_order_idx
CREATE INDEX `services_includes_order_idx` ON `services_includes` (`_order`);
-- index services_includes_parent_id_idx
CREATE INDEX `services_includes_parent_id_idx` ON `services_includes` (`_parent_id`);
-- index services_option_groups_options_order_idx
CREATE INDEX `services_option_groups_options_order_idx` ON `services_option_groups_options` (`_order`);
-- index services_option_groups_options_parent_id_idx
CREATE INDEX `services_option_groups_options_parent_id_idx` ON `services_option_groups_options` (`_parent_id`);
-- index services_option_groups_order_idx
CREATE INDEX `services_option_groups_order_idx` ON `services_option_groups` (`_order`);
-- index services_option_groups_parent_id_idx
CREATE INDEX `services_option_groups_parent_id_idx` ON `services_option_groups` (`_parent_id`);
-- index services_shapes_order_idx
CREATE INDEX `services_shapes_order_idx` ON `services_shapes` (`_order`);
-- index services_shapes_parent_id_idx
CREATE INDEX `services_shapes_parent_id_idx` ON `services_shapes` (`_parent_id`);
-- index services_slug_idx
CREATE UNIQUE INDEX `services_slug_idx` ON `services` (`slug`);
-- index services_updated_at_idx
CREATE INDEX `services_updated_at_idx` ON `services` (`updated_at`);
-- index site_settings_created_at_idx
CREATE INDEX `site_settings_created_at_idx` ON `site_settings` (`created_at`);
-- index site_settings_key_idx
CREATE UNIQUE INDEX `site_settings_key_idx` ON `site_settings` (`key`);
-- index site_settings_updated_at_idx
CREATE INDEX `site_settings_updated_at_idx` ON `site_settings` (`updated_at`);
-- index story_events_order_idx
CREATE INDEX `story_events_order_idx` ON `story_events` (`_order`);
-- index story_events_parent_id_idx
CREATE INDEX `story_events_parent_id_idx` ON `story_events` (`_parent_id`);
-- index webauthn_credentials_created_at_idx
CREATE INDEX `webauthn_credentials_created_at_idx` ON `webauthn_credentials` (`created_at`);
-- index webauthn_credentials_updated_at_idx
CREATE INDEX `webauthn_credentials_updated_at_idx` ON `webauthn_credentials` (`updated_at`);
-- index webauthn_credentials_user_id_idx
CREATE INDEX `webauthn_credentials_user_id_idx` ON `webauthn_credentials` (`user_id_id`);

-- table studio_products
CREATE TABLE `studio_products` (
    `id` text(36) PRIMARY KEY NOT NULL,
    `slug` text NOT NULL,
    `name` text NOT NULL,
    `tagline_ru` text,
    `tagline_en` text,
    `summary_ru` text,
    `summary_en` text,
    `version` text,
    `status_label` text,
    `repo_url` text,
    `changelog_path` text DEFAULT 'CHANGELOG.md',
    `download_url` text,
    `page_path` text,
    `facts` text,
    `is_published` integer DEFAULT false NOT NULL,
    `sort_order` integer DEFAULT 0 NOT NULL,
    `changelog_json` text,
    `changelog_synced_at` text,
    `updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
    `created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
-- index studio_products_slug_idx
CREATE UNIQUE INDEX `studio_products_slug_idx` ON `studio_products` (`slug`);
-- index studio_products_sort_order_idx
CREATE INDEX `studio_products_sort_order_idx` ON `studio_products` (`sort_order`);

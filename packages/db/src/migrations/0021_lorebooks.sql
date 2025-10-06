CREATE TABLE `character_lorebooks` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`lorebook_id` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lorebook_id`) REFERENCES `lorebooks`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_character_lorebooks_unique` ON `character_lorebooks` (`character_id`,`lorebook_id`);--> statement-breakpoint
CREATE TABLE `lorebooks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`data` text NOT NULL,
	`fingerprint` text NOT NULL,
	`entry_count` integer NOT NULL,
	`source` text DEFAULT 'manual',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lorebooks_fingerprint` ON `lorebooks` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `idx_lorebooks_name` ON `lorebooks` (`name`);--> statement-breakpoint
CREATE TABLE `scenario_lorebooks` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`lorebook_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lorebook_id`) REFERENCES `lorebooks`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scenario_lorebooks_unique` ON `scenario_lorebooks` (`scenario_id`,`lorebook_id`);--> statement-breakpoint
CREATE INDEX `idx_scenario_lorebooks_order` ON `scenario_lorebooks` (`scenario_id`,`order_index`);
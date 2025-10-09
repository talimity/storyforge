CREATE TABLE `scenario_character_lorebook_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`character_lorebook_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`priority` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_lorebook_id`) REFERENCES `character_lorebooks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scenario_character_lorebook_overrides_unique` ON `scenario_character_lorebook_overrides` (`scenario_id`,`character_lorebook_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scenario_lorebooks` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`lorebook_id` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`lorebook_id`) REFERENCES `lorebooks`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_scenario_lorebooks`("id", "scenario_id", "lorebook_id", "enabled", "created_at", "updated_at") SELECT "id", "scenario_id", "lorebook_id", "enabled", "created_at", "updated_at" FROM `scenario_lorebooks`;--> statement-breakpoint
DROP TABLE `scenario_lorebooks`;--> statement-breakpoint
ALTER TABLE `__new_scenario_lorebooks` RENAME TO `scenario_lorebooks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scenario_lorebooks_unique` ON `scenario_lorebooks` (`scenario_id`,`lorebook_id`);
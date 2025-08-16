PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`name` text NOT NULL,
	`index` integer DEFAULT 0 NOT NULL,
	`first_turn_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`first_turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_chapters`("id", "scenario_id", "name", "index", "first_turn_id", "created_at", "updated_at") SELECT "id", "scenario_id", "name", "index", "first_turn_id", "created_at", "updated_at" FROM `chapters`;--> statement-breakpoint
DROP TABLE `chapters`;--> statement-breakpoint
ALTER TABLE `__new_chapters` RENAME TO `chapters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_scenario_id_index_unique` ON `chapters` (`scenario_id`,`index`);--> statement-breakpoint
CREATE TABLE `__new_scenario_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`character_id` text,
	`type` text DEFAULT 'character' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`role` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_scenario_participants`("id", "scenario_id", "character_id", "type", "status", "role", "order_index", "created_at", "updated_at") SELECT "id", "scenario_id", "character_id", "type", "status", "role", "order_index", "created_at", "updated_at" FROM `scenario_participants`;--> statement-breakpoint
DROP TABLE `scenario_participants`;--> statement-breakpoint
ALTER TABLE `__new_scenario_participants` RENAME TO `scenario_participants`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scenario_character_unique` ON `scenario_participants` (`scenario_id`,`character_id`);
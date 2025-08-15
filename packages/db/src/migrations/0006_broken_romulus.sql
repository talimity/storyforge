ALTER TABLE `scenario_characters` RENAME TO `scenario_participants`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scenario_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`character_id` text NOT NULL,
	`role` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`assigned_at` integer NOT NULL,
	`unassigned_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_scenario_participants`("id", "scenario_id", "character_id", "role", "order_index", "assigned_at", "unassigned_at", "created_at", "updated_at") SELECT "id", "scenario_id", "character_id", "role", "order_index", "assigned_at", "unassigned_at", "created_at", "updated_at" FROM `scenario_participants`;--> statement-breakpoint
DROP TABLE `scenario_participants`;--> statement-breakpoint
ALTER TABLE `__new_scenario_participants` RENAME TO `scenario_participants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_participants_scenario_id_character_id_unique` ON `scenario_participants` (`scenario_id`,`character_id`);
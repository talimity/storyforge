PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`settings` text DEFAULT '{}' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_scenarios`("id", "name", "description", "status", "settings", "metadata", "created_at", "updated_at") SELECT "id", "name", "description", "status", "settings", "metadata", "created_at", "updated_at" FROM `scenarios`;--> statement-breakpoint
DROP TABLE `scenarios`;--> statement-breakpoint
ALTER TABLE `__new_scenarios` RENAME TO `scenarios`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `characters` ADD `card_focal_point` text DEFAULT '{"x":0.5,"y":0.3,"w":0.5,"h":0.5,"c":0}';
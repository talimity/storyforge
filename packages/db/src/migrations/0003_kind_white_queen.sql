PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`legacy_personality` text,
	`legacy_scenario` text,
	`creator` text,
	`creator_notes` text,
	`custom_system_prompt` text,
	`custom_post_history_instructions` text,
	`tags` text DEFAULT '[]',
	`revision` text,
	`original_card_data` text,
	`card_image` blob,
	`card_focal_point` text DEFAULT '{"x":0.5,"y":0.3,"w":0.5,"h":0.5,"c":0}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_characters`("id", "name", "description", "legacy_personality", "legacy_scenario", "creator", "creator_notes", "custom_system_prompt", "custom_post_history_instructions", "tags", "revision", "original_card_data", "card_image", "card_focal_point", "created_at", "updated_at") SELECT "id", "name", "description", "legacy_personality", "legacy_scenario", "creator", "creator_notes", "custom_system_prompt", "custom_post_history_instructions", "tags", "revision", "original_card_data", "card_image", "card_focal_point", "created_at", "updated_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
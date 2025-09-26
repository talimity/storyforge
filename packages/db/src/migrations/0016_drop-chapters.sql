DROP TABLE `chapters`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`parent_turn_id` text,
	`sibling_order` text DEFAULT 'm' NOT NULL,
	`author_participant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_participant_id`) REFERENCES `scenario_participants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `__new_turns`("id", "scenario_id", "parent_turn_id", "sibling_order", "author_participant_id", "created_at", "updated_at") SELECT "id", "scenario_id", "parent_turn_id", "sibling_order", "author_participant_id", "created_at", "updated_at" FROM `turns`;--> statement-breakpoint
DROP TABLE `turns`;--> statement-breakpoint
ALTER TABLE `__new_turns` RENAME TO `turns`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_turn_parent` ON `turns` (`parent_turn_id`);--> statement-breakpoint
CREATE INDEX `idx_turn_scenario` ON `turns` (`scenario_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_uniq_turn_parent_order` ON `turns` (`parent_turn_id`,`sibling_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_root_per_scenario` ON `turns` (`scenario_id`) WHERE parent_turn_id IS NULL;
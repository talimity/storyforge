CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`parent_turn_id` text,
	`sibling_order` integer DEFAULT 0 NOT NULL,
	`author_participant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_participant_id`) REFERENCES `scenario_participants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_turn_parent` ON `turns` (`parent_turn_id`);--> statement-breakpoint
CREATE INDEX `idx_turn_scenario` ON `turns` (`scenario_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_root_per_scenario` ON `turns` (`scenario_id`) WHERE parent_turn_id IS NULL;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `current_turn_id` text REFERENCES turns(id);
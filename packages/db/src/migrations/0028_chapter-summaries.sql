CREATE TABLE `chapter_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`closing_event_id` text NOT NULL,
	`closing_turn_id` text NOT NULL,
	`chapter_number` integer NOT NULL,
	`range_start_chapter_number` integer NOT NULL,
	`range_end_chapter_number` integer NOT NULL,
	`summary_text` text NOT NULL,
	`summary_json` text,
	`turn_count` integer NOT NULL,
	`max_turn_updated_at` integer NOT NULL,
	`span_fingerprint` text NOT NULL,
	`workflow_id` text,
	`model_profile_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`closing_event_id`) REFERENCES `timeline_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`closing_turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`model_profile_id`) REFERENCES `model_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_summaries_closing_event` ON `chapter_summaries` (`closing_event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_chapter_summaries_range` ON `chapter_summaries` (`scenario_id`,`range_start_chapter_number`,`range_end_chapter_number`,`closing_event_id`);
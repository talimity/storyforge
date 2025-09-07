DROP INDEX `idx_one_pending_intent_per_scenario`;--> statement-breakpoint
ALTER TABLE `intents` ADD `input_text` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_pending_intent_per_scenario` ON `intents` (`scenario_id`) WHERE status IN ('pending','running');--> statement-breakpoint
ALTER TABLE `intents` DROP COLUMN `parameters`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE `intent_effects`;--> statement-breakpoint
CREATE TABLE `intent_effects` (
	`intent_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`kind` text NOT NULL,
	`turn_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`intent_id`, `sequence`),
	FOREIGN KEY (`intent_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
PRAGMA foreign_keys=ON;

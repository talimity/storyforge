CREATE TABLE `turn_content` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text NOT NULL,
	`key` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_turn_content_turn` ON `turn_content` (`turn_id`);--> statement-breakpoint
CREATE INDEX `idx_turn_content_key` ON `turn_content` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_turn_content_unique` ON `turn_content` (`turn_id`,`key`);--> statement-breakpoint
ALTER TABLE `scenario_participants` DROP COLUMN `assigned_at`;--> statement-breakpoint
ALTER TABLE `scenario_participants` DROP COLUMN `unassigned_at`;
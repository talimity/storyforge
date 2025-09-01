CREATE TABLE `intent_effects` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`kind` text NOT NULL,
	`turn_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `intents` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`target_participant_id` text,
	`parameters` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_participant_id`) REFERENCES `scenario_participants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_pending_intent_per_scenario` ON `intents` (`scenario_id`) WHERE status = 'pending';--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` integer DEFAULT 1 NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL,
	`steps` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
DROP TABLE `gentasks`;
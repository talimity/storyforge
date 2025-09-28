PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`turn_id` text,
	`order_key` text DEFAULT 'm' NOT NULL,
	`kind` text NOT NULL,
	`payload_version` integer DEFAULT 1 NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_timeline_events`("id", "scenario_id", "turn_id", "order_key", "kind", "payload_version", "payload", "created_at", "updated_at") SELECT "id", "scenario_id", "turn_id", "order_key", "kind", "payload_version", "payload", "created_at", "updated_at" FROM `timeline_events`;--> statement-breakpoint
DROP TABLE `timeline_events`;--> statement-breakpoint
ALTER TABLE `__new_timeline_events` RENAME TO `timeline_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_turn` ON `timeline_events` (`turn_id`,`order_key`) WHERE turn_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_initial` ON `timeline_events` (`scenario_id`,`order_key`) WHERE turn_id IS NULL;--> statement-breakpoint
CREATE INDEX `idx_events_scenario` ON `timeline_events` (`scenario_id`,`kind`);
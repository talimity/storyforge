DROP TABLE `chapter_break_events`;--> statement-breakpoint
DROP TABLE `presence_events`;--> statement-breakpoint
DROP TABLE `scene_set_events`;--> statement-breakpoint
ALTER TABLE `timeline_events` ADD `payload_version` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `timeline_events` ADD `payload` text NOT NULL;--> statement-breakpoint
DROP VIEW `events_by_turn_v`;--> statement-breakpoint
DROP VIEW `timeline_events_payload_v`;
ALTER TABLE `characters` ADD `is_starred` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `is_starred` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_scenario_participant_character` ON `scenario_participants` (`character_id`);--> statement-breakpoint
CREATE INDEX `idx_turn_author_participant` ON `turns` (`author_participant_id`);
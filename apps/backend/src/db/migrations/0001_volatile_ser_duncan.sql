ALTER TABLE `scenario_characters` ADD `role` text;--> statement-breakpoint
ALTER TABLE `scenario_characters` ADD `assigned_at` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `scenario_characters` ADD `unassigned_at` integer;--> statement-breakpoint
ALTER TABLE `scenario_characters` ADD `created_at` integer NOT NULL;--> statement-breakpoint
ALTER TABLE `scenario_characters` ADD `updated_at` integer NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_characters_scenario_id_character_id_unique` ON `scenario_characters` (`scenario_id`,`character_id`);--> statement-breakpoint
ALTER TABLE `scenarios` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `settings` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `metadata` text DEFAULT '{}';
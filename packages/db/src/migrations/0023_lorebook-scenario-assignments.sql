DROP INDEX `idx_scenario_lorebooks_order`;--> statement-breakpoint
ALTER TABLE `scenario_lorebooks` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `scenario_lorebooks` ADD `source_character_id` text REFERENCES characters(id);--> statement-breakpoint
ALTER TABLE `scenario_lorebooks` DROP COLUMN `order_index`;

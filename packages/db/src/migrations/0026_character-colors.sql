ALTER TABLE `characters` ADD `default_color` text DEFAULT '#6b7280' NOT NULL;--> statement-breakpoint
ALTER TABLE `scenario_participants` ADD `color_override` text;
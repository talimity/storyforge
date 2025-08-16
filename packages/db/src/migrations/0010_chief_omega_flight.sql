ALTER TABLE `character_greetings` RENAME TO `character_starters`;--> statement-breakpoint
ALTER TABLE `turn_content` RENAME TO `turn_layer`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_character_starters` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`message` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_character_starters`("id", "character_id", "message", "is_primary", "created_at", "updated_at") SELECT "id", "character_id", "message", "is_primary", "created_at", "updated_at" FROM `character_starters`;--> statement-breakpoint
DROP TABLE `character_starters`;--> statement-breakpoint
ALTER TABLE `__new_character_starters` RENAME TO `character_starters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_turn_layer` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text NOT NULL,
	`key` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_turn_layer`("id", "turn_id", "key", "content", "created_at", "updated_at") SELECT "id", "turn_id", "key", "content", "created_at", "updated_at" FROM `turn_layer`;--> statement-breakpoint
DROP TABLE `turn_layer`;--> statement-breakpoint
ALTER TABLE `__new_turn_layer` RENAME TO `turn_layer`;--> statement-breakpoint
CREATE INDEX `idx_turn_layer_turn` ON `turn_layer` (`turn_id`);--> statement-breakpoint
CREATE INDEX `idx_turn_layer_key` ON `turn_layer` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_layer_per_turn_key` ON `turn_layer` (`turn_id`,`key`);--> statement-breakpoint
DROP TABLE `scenarios`;--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`root_turn_id` text,
	`anchor_turn_id` text,
	`settings` text DEFAULT '{}::json' NOT NULL,
	`metadata` text DEFAULT '{}::json' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`root_turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`anchor_turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `__new_scenario_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`character_id` text,
	`type` text DEFAULT 'character' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`role` text,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_scenario_participants`("id", "scenario_id", "character_id", "role", "order_index", "created_at", "updated_at") SELECT "id", "scenario_id", "character_id", "role", "order_index", "created_at", "updated_at" FROM `scenario_participants`;--> statement-breakpoint
DROP TABLE `scenario_participants`;--> statement-breakpoint
ALTER TABLE `__new_scenario_participants` RENAME TO `scenario_participants`;--> statement-breakpoint
CREATE UNIQUE INDEX `scenario_participants_scenario_id_character_id_unique` ON `scenario_participants` (`scenario_id`,`character_id`);--> statement-breakpoint
ALTER TABLE `chapters` ADD `first_turn_id` text NOT NULL REFERENCES turns(id);

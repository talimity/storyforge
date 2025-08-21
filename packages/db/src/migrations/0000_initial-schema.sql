CREATE TABLE `chapters` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`name` text NOT NULL,
	`index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `chapters_scenario_id_index_unique` ON `chapters` (`scenario_id`,`index`);--> statement-breakpoint
CREATE TABLE `character_examples` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`example_template` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `character_starters` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`message` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`card_type` text DEFAULT 'character' NOT NULL,
	`legacy_personality` text,
	`legacy_scenario` text,
	`creator` text,
	`creator_notes` text,
	`custom_system_prompt` text,
	`custom_post_history_instructions` text,
	`tags` text DEFAULT '[]',
	`revision` text,
	`tavern_card_data` text,
	`portrait` blob,
	`portrait_focal_point` text DEFAULT '{"x":0.5,"y":0.3,"w":0.5,"h":0.5,"c":0}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenario_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`character_id` text,
	`type` text DEFAULT 'character' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`role` text,
	`is_user_proxy` integer DEFAULT false NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_scenario_character_unique` ON `scenario_participants` (`scenario_id`,`character_id`);--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`root_turn_id` text,
	`anchor_turn_id` text,
	`settings` text DEFAULT '{}' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`root_turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`anchor_turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `turn_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text NOT NULL,
	`key` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_turn_layer_turn` ON `turn_layers` (`turn_id`);--> statement-breakpoint
CREATE INDEX `idx_turn_layer_key` ON `turn_layers` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_layer_per_turn_key` ON `turn_layers` (`turn_id`,`key`);--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`chapter_id` text NOT NULL,
	`parent_turn_id` text,
	`sibling_order` text DEFAULT 'm' NOT NULL,
	`author_participant_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`chapter_id`) REFERENCES `chapters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_participant_id`) REFERENCES `scenario_participants`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_turn_parent` ON `turns` (`parent_turn_id`);--> statement-breakpoint
CREATE INDEX `idx_turn_scenario` ON `turns` (`scenario_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_uniq_turn_parent_order` ON `turns` (`parent_turn_id`,`sibling_order`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_root_per_scenario` ON `turns` (`scenario_id`) WHERE parent_turn_id IS NULL;
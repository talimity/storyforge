CREATE TABLE `character_examples` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`example_template` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `character_greetings` (
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
	`legacy_personality` text,
	`legacy_scenario` text,
	`creator` text,
	`creator_notes` text,
	`custom_system_prompt` text,
	`custom_post_history_instructions` text,
	`tags` text DEFAULT '[]',
	`revision` text,
	`original_card_data` text,
	`card_image` blob,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scenario_characters` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`character_id` text NOT NULL,
	`order_index` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `turns` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`character_id` text,
	`content` text NOT NULL,
	`timestamp` integer NOT NULL,
	`order_index` integer NOT NULL,
	`agent_data` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE set null
);

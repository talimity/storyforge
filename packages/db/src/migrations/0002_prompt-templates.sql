CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`task` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`layout` text NOT NULL,
	`slots` text NOT NULL,
	`response_format` text,
	`response_transforms` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

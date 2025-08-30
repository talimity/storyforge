CREATE TABLE `gentasks` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`version` integer DEFAULT 1 NOT NULL,
	`is_builtin` integer DEFAULT false NOT NULL,
	`steps` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
DROP TABLE `workflows`;--> statement-breakpoint
ALTER TABLE `prompt_templates` ADD `kind` text NOT NULL;--> statement-breakpoint
ALTER TABLE `prompt_templates` DROP COLUMN `task`;
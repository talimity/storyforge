ALTER TABLE `prompt_templates` ADD `description` text;--> statement-breakpoint
ALTER TABLE `prompt_templates` DROP COLUMN `response_format`;--> statement-breakpoint
ALTER TABLE `prompt_templates` DROP COLUMN `response_transforms`;
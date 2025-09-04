PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_provider_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`auth` text NOT NULL,
	`base_url` text,
	`capabilities` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "chk_consistent_capabilities" CHECK((kind = 'openai-compatible' AND capabilities IS NOT NULL) OR (kind != 'openai-compatible' AND capabilities IS NULL))
);
--> statement-breakpoint
INSERT INTO `__new_provider_configs`("id", "kind", "name", "auth", "base_url", "created_at", "updated_at") SELECT "id", "kind", "name", "auth", "base_url", "created_at", "updated_at" FROM `provider_configs`;--> statement-breakpoint
DROP TABLE `provider_configs`;--> statement-breakpoint
ALTER TABLE `__new_provider_configs` RENAME TO `provider_configs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;

ALTER TABLE `turn_layer` RENAME TO `turn_layers`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_turn_layers` (
	`id` text PRIMARY KEY NOT NULL,
	`turn_id` text NOT NULL,
	`key` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_turn_layers`("id", "turn_id", "key", "content", "created_at", "updated_at") SELECT "id", "turn_id", "key", "content", "created_at", "updated_at" FROM `turn_layers`;--> statement-breakpoint
DROP TABLE `turn_layers`;--> statement-breakpoint
ALTER TABLE `__new_turn_layers` RENAME TO `turn_layers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_turn_layer_turn` ON `turn_layers` (`turn_id`);--> statement-breakpoint
CREATE INDEX `idx_turn_layer_key` ON `turn_layers` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_layer_per_turn_key` ON `turn_layers` (`turn_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_uniq_turn_parent_order` ON `turns` (`parent_turn_id`,`sibling_order`);
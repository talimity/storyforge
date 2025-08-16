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
DROP TABLE `turns`;
CREATE TABLE `workflow_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`workflow_task` text NOT NULL,
	`scope_kind` text NOT NULL,
	`scenario_id` text,
	`character_id` text,
	`participant_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `scenario_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workflow_id`,`workflow_task`) REFERENCES `workflows`(`id`,`task`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chk_consistent_scope_kind" CHECK(
      (scope_kind = 'scenario' AND scenario_id IS NOT NULL)
      OR
      (scope_kind = 'character' AND character_id IS NOT NULL)
      OR
      (scope_kind = 'participant' AND participant_id IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_character_task_target` ON `workflow_scopes` (`workflow_task`,`character_id`) WHERE scope_kind = 'character';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_scenario_task_target` ON `workflow_scopes` (`workflow_task`,`scenario_id`) WHERE scope_kind = 'scenario';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_participant_task_target` ON `workflow_scopes` (`workflow_task`,`participant_id`) WHERE scope_kind = 'participant';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_one_default_task_target` ON `workflow_scopes` (`workflow_task`) WHERE scope_kind = 'default';--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TABLE `intent_effects`;--> statement-breakpoint
CREATE TABLE `intent_effects` (
	`id` text PRIMARY KEY NOT NULL,
	`intent_id` text NOT NULL,
	`kind` text NOT NULL,
	`turn_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_workflows_id_task` ON `workflows` (`id`,`task`);

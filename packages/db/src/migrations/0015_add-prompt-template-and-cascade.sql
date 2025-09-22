PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_generation_run_steps` (
	`run_id` text NOT NULL,
	`step_id` text NOT NULL,
	`idx` integer NOT NULL,
	`name` text,
	`model_profile_id` text,
	`prompt_template_id` text,
	`model_id` text,
	`hints` text,
	`prompts_rendered` text DEFAULT '[]' NOT NULL,
	`prompts_transformed` text,
	`api_payload` text,
	`response` text,
	`captured_outputs` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`run_id`, `step_id`),
	FOREIGN KEY (`run_id`) REFERENCES `generation_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`model_profile_id`) REFERENCES `model_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`prompt_template_id`) REFERENCES `prompt_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_generation_run_steps`("run_id", "step_id", "idx", "name", "model_profile_id", "prompt_template_id", "model_id", "hints", "prompts_rendered", "prompts_transformed", "api_payload", "response", "captured_outputs", "created_at", "updated_at") SELECT "run_id", "step_id", "idx", "name", "model_profile_id", NULL, "model_id", "hints", "prompts_rendered", "prompts_transformed", "api_payload", "response", "captured_outputs", "created_at", "updated_at" FROM `generation_run_steps`;--> statement-breakpoint
DROP TABLE `generation_run_steps`;--> statement-breakpoint
ALTER TABLE `__new_generation_run_steps` RENAME TO `generation_run_steps`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_generation_run_steps_order` ON `generation_run_steps` (`run_id`,`idx`);--> statement-breakpoint
CREATE TABLE `__new_generation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`intent_id` text NOT NULL,
	`effect_sequence` integer,
	`turn_id` text,
	`participant_id` text NOT NULL,
	`workflow_id` text NOT NULL,
	`branch_from_turn_id` text,
	`status` text NOT NULL,
	`error` text,
	`step_order` text DEFAULT '[]' NOT NULL,
	`final_outputs` text,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`intent_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `scenario_participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_from_turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_generation_runs_status" CHECK("__new_generation_runs"."status" IN ('running','finished','error','cancelled'))
);
--> statement-breakpoint
INSERT INTO `__new_generation_runs`("id", "scenario_id", "intent_id", "effect_sequence", "turn_id", "participant_id", "workflow_id", "branch_from_turn_id", "status", "error", "step_order", "final_outputs", "started_at", "finished_at", "created_at", "updated_at") SELECT "id", "scenario_id", "intent_id", "effect_sequence", "turn_id", "participant_id", "workflow_id", "branch_from_turn_id", "status", "error", "step_order", "final_outputs", "started_at", "finished_at", "created_at", "updated_at" FROM `generation_runs`;--> statement-breakpoint
DROP TABLE `generation_runs`;--> statement-breakpoint
ALTER TABLE `__new_generation_runs` RENAME TO `generation_runs`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_generation_runs_turn` ON `generation_runs` (`turn_id`) WHERE "generation_runs"."turn_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_generation_runs_intent` ON `generation_runs` (`intent_id`);--> statement-breakpoint
CREATE INDEX `idx_generation_runs_scenario` ON `generation_runs` (`scenario_id`);

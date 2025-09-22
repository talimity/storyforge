CREATE TABLE `generation_run_steps` (
	`run_id` text NOT NULL,
	`step_id` text NOT NULL,
	`idx` integer NOT NULL,
	`name` text,
	`model_profile_id` text,
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
	FOREIGN KEY (`model_profile_id`) REFERENCES `model_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_generation_run_steps_order` ON `generation_run_steps` (`run_id`,`idx`);--> statement-breakpoint
CREATE TABLE `generation_runs` (
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
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`participant_id`) REFERENCES `scenario_participants`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`branch_from_turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "chk_generation_runs_status" CHECK("generation_runs"."status" IN ('running','finished','error','cancelled'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_generation_runs_turn` ON `generation_runs` (`turn_id`) WHERE "generation_runs"."turn_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_generation_runs_intent` ON `generation_runs` (`intent_id`);--> statement-breakpoint
CREATE INDEX `idx_generation_runs_scenario` ON `generation_runs` (`scenario_id`);

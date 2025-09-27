CREATE TABLE `timeline_events` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`position` text DEFAULT 'after' NOT NULL,
	`order_key` text DEFAULT 'm' NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`turn_id`) REFERENCES `turns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "chk_eventenv_position" CHECK("timeline_events"."position" in ('before','after'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_turn` ON `timeline_events` (`turn_id`,`position`,`order_key`);--> statement-breakpoint
CREATE INDEX `idx_events_scenario` ON `timeline_events` (`scenario_id`,`kind`);--> statement-breakpoint
CREATE TABLE `chapter_break_events` (
	`id` text PRIMARY KEY NOT NULL,
	`next_chapter_title` text NOT NULL,
	`summary_text` text,
	`summary_status` text DEFAULT 'missing' NOT NULL,
	`summary_basis_hash` text,
	FOREIGN KEY (`id`) REFERENCES `timeline_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `presence_events` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`active` integer NOT NULL,
	`reason` text,
	FOREIGN KEY (`id`) REFERENCES `timeline_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `scenario_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_presence_participant` ON `presence_events` (`participant_id`);--> statement-breakpoint
CREATE TABLE `scene_set_events` (
	`id` text PRIMARY KEY NOT NULL,
	`scene_name` text NOT NULL,
	`description` text,
	FOREIGN KEY (`id`) REFERENCES `timeline_events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE VIEW `events_by_turn_v` AS SELECT turn_id,
       position,
       json_group_array(json(event_payload)) AS events
FROM (SELECT turn_id,
             position,
             json_object(
                     'id', id,
                     'kind', kind,
                     'orderKey', order_key,
                     'payload', json(payload)
             ) AS event_payload
      FROM "timeline_events_payload_v"
      ORDER BY turn_id, position, order_key)
GROUP BY turn_id, position
;--> statement-breakpoint
CREATE VIEW `timeline_events_payload_v` AS SELECT e.id,
       e.scenario_id,
       e.turn_id,
       e.position,
       e.order_key,
       e.kind,
       json_object(
               'nextChapterTitle', c.next_chapter_title,
               'summaryText', c.summary_text,
               'summaryStatus', c.summary_status,
               'summaryBasisHash', c.summary_basis_hash
       ) AS payload,
       e.created_at,
       e.updated_at
FROM "timeline_events" e
         INNER JOIN "chapter_break_events" c ON c.id = e.id
UNION ALL
SELECT e.id,
       e.scenario_id,
       e.turn_id,
       e.position,
       e.order_key,
       e.kind,
       json_object(
               'sceneName', s.scene_name,
               'description', s.description
       ) AS payload,
       e.created_at,
       e.updated_at
FROM "timeline_events" e
         INNER JOIN "scene_set_events" s ON s.id = e.id
UNION ALL
SELECT e.id,
       e.scenario_id,
       e.turn_id,
       e.position,
       e.order_key,
       e.kind,
       json_object(
               'participantId', p.participant_id,
               'active', JSON(IIF(p.active, 'true', 'false')),
               'reason', p.reason
       ) AS payload,
       e.created_at,
       e.updated_at
FROM "timeline_events" e
         INNER JOIN "presence_events" p ON p.id = e.id
;

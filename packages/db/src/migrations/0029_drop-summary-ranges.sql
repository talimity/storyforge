DROP INDEX `idx_chapter_summaries_range`;--> statement-breakpoint
ALTER TABLE `chapter_summaries` DROP COLUMN `range_start_chapter_number`;--> statement-breakpoint
ALTER TABLE `chapter_summaries` DROP COLUMN `range_end_chapter_number`;
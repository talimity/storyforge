# Chapters System Architecture

## Purpose
This document explains how StoryForge models chapters, derives per-branch metadata, and uses that
state to power summarization workflows and prompt rendering. The goal is to make it clear how a
`chapter_break` event turns into a summarized chapter that templates can reference even on a
branched timeline.

## Core Concepts
- **Chapter break events** mark the end of one chapter and the title of the chapter that follows.
  They are stored as timeline events with the `chapter_break` kind and a `nextChapterTitle` payload.
- **Derived chapter entries** are computed at runtime by the `chaptersConcern` reducer. Each entry
  captures a sequential chapter number, optional title, closing turn id, and the event id that
  opened the chapter.
- **Chapter spans** represent the inclusive list of turns between two successive chapter break
  entries. Spans are used by the summarization workflow to know which turns should feed a summary.
- **Summaries and titles** are stored on the closing chapter break event. Because every closing event
  has exactly one path back to the root, they remain unambiguous even when the timeline branches.
- **Narrative contexts** propagate both saved summaries and derived chapter entries to the prompt
  layer so templates and attachment pipelines can reference chapters without hitting the database.

## Data Flow Overview
1. Players create a `chapter_break` event on the final turn of a chapter, optionally providing the
   title of the upcoming chapter.
2. The timeline derivation pipeline replays events along the active root→leaf path. The
   `chaptersConcern` reducer appends a new chapter entry for each break and records the payload
   title, if any.
3. When a chapter summary is generated, the `ChapterSummaryContextBuilder` loads the enriched turns
   for the closing branch, builds the chapter span, and gathers supporting data (characters,
   lorebooks, prior summaries, and derived chapters). The resulting
   `ChapterSummarizationContext` satisfies the prompt task contract.
4. The chapter summarization workflow renders prompts against that context, calls inference, and
   persists the resulting text and structured JSON to the `chapter_summaries` table keyed by the
   closing event id.
5. Subsequent narrative tasks (turn generation, more summarization, diagnostics) reuse the same
   derivation step to expose both the saved summaries and the most recent chapter metadata inside the
   prompt context.
6. Prompt recipes that window turns by chapter use derived chapter numbers to slice the timeline,
   while attachment builders (for example, chapter separators) now fall back to the derived titles
   when a chapter has not yet been summarized.

## Branching Semantics
- Because chapter entries are derived along the active path, each branch can accrue its own set of
  titles and summary rows. Switching the anchor simply replays the reducer for the new path.
- Saving a summary writes a row keyed by `closing_event_id`; if the branch diverges earlier in the
  chapter, the closing event id will differ and therefore store a separate summary.
- When a branch is pruned, both the closing event and any dependent summary rows are deleted via
  cascading foreign keys, so derived state remains consistent the next time the path is replayed.

## Prompt Integration
- Narrative contexts now expose a `chapters` array alongside `chapterSummaries`. Attachments and
  templates can consult `chapters` to obtain titles even if a summary has not been generated.
- The timeline recipes’ chapter window arguments operate purely on the derived `chapterNumber`
  stored on each turn, keeping templating declarative.
- Chapter separator attachments emit injections before the first turn of each chapter. With the new
  `chapters` metadata they can label separators using `nextChapterTitle` immediately, rather than
  waiting for the summarization workflow to run.

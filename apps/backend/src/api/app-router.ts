import { router } from "./index.js";
import { chapterSummariesRouter } from "./routers/chapter-summaries.js";
import { charactersRouter } from "./routers/characters.js";
import { chatImportRouter } from "./routers/chat-import.js";
import { intentsRouter } from "./routers/intents.js";
import {
  characterLorebooksRouter,
  lorebooksRouter,
  scenarioLorebooksRouter,
} from "./routers/lorebooks.js";
import { providersRouter } from "./routers/providers.js";
import { scenariosRouter } from "./routers/scenarios.js";
import { templatesRouter } from "./routers/templates.js";
import { timelineRouter } from "./routers/timeline.js";
import { timelineEventsRouter } from "./routers/timeline-events.js";
import { workflowsRouter } from "./routers/workflows.js";

export const allRouters = {
  characters: charactersRouter,
  chatImport: chatImportRouter,
  chapterSummaries: chapterSummariesRouter,
  lorebooks: lorebooksRouter,
  scenarioLorebooks: scenarioLorebooksRouter,
  characterLorebooks: characterLorebooksRouter,
  scenarios: scenariosRouter,
  intents: intentsRouter,
  providers: providersRouter,
  templates: templatesRouter,
  timeline: timelineRouter,
  timelineEvents: timelineEventsRouter,
  workflows: workflowsRouter,
};

export const appRouter = router(allRouters);

export type AppRouter = typeof appRouter;

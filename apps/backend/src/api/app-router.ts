import { router } from "./index.js";
import { charactersRouter } from "./routers/characters.js";
import { chatImportRouter } from "./routers/chat-import.js";
import { playRouter } from "./routers/play.js";
import { providersRouter } from "./routers/providers.js";
import { scenariosRouter } from "./routers/scenarios.js";
import { templatesRouter } from "./routers/templates.js";
import { workflowsRouter } from "./routers/workflows.js";

export const allRouters = {
  characters: charactersRouter,
  chatImport: chatImportRouter,
  scenarios: scenariosRouter,
  play: playRouter,
  providers: providersRouter,
  templates: templatesRouter,
  workflows: workflowsRouter,
};

export const appRouter = router(allRouters);

export type AppRouter = typeof appRouter;

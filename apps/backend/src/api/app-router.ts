import { router } from "@/api/index";
import { charactersRouter } from "@/api/routers/characters";
import { chatImportRouter } from "@/api/routers/chat-import";
import { playRouter } from "@/api/routers/play";
import { providersRouter } from "@/api/routers/providers";
import { scenariosRouter } from "@/api/routers/scenarios";
import { templatesRouter } from "@/api/routers/templates";

export const allRouters = {
  characters: charactersRouter,
  chatImport: chatImportRouter,
  scenarios: scenariosRouter,
  play: playRouter,
  providers: providersRouter,
  templates: templatesRouter,
};

export const appRouter = router(allRouters);

export type AppRouter = typeof appRouter;

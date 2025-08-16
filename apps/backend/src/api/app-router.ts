import { router } from "@/api/index";
import { charactersRouter } from "@/api/routers/characters";
import { debugRouter } from "@/api/routers/debug";
import { playRouter } from "@/api/routers/play";
import { scenariosRouter } from "@/api/routers/scenarios";

export const allRouters = {
  characters: charactersRouter,
  debug: debugRouter,
  scenarios: scenariosRouter,
  play: playRouter,
};

export const appRouter = router(allRouters);

export type AppRouter = typeof appRouter;

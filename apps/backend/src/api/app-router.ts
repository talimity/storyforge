import { router } from "@/api/index";
import { charactersRouter } from "@/api/routers/characters";
import { debugRouter } from "@/api/routers/debug";
import { scenariosRouter } from "@/api/routers/scenarios";

export const allRouters = {
  characters: charactersRouter,
  debug: debugRouter,
  scenarios: scenariosRouter,
};

export const appRouter = router(allRouters);

export type AppRouter = typeof appRouter;

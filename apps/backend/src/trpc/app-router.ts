import { router } from "./index";
import { charactersRouter } from "./routers/characters";
import { debugRouter } from "./routers/debug";
import { scenariosRouter } from "./routers/scenarios";

export const allRouters = {
  characters: charactersRouter,
  debug: debugRouter,
  scenarios: scenariosRouter,
};

export const appRouter = router(allRouters);

export type AppRouter = typeof appRouter;

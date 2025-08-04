import { router } from "./index";
import { charactersRouter } from "./routers/characters";
import { debugRouter } from "./routers/debug";

export const allRouters = {
  characters: charactersRouter,
  debug: debugRouter,
};

export const appRouter = router(allRouters);

export type AppRouter = typeof appRouter;

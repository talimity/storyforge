import { router } from "@/trpc/index";
import { charactersRouter } from "@/trpc/routers/characters";
import { debugRouter } from "@/trpc/routers/debug";
import { scenariosRouter } from "@/trpc/routers/scenarios";

export const allRouters = {
  characters: charactersRouter,
  debug: debugRouter,
  scenarios: scenariosRouter,
};

export const appRouter = router(allRouters);

export type AppRouter = typeof appRouter;

import { generateOpenApiDocument } from "trpc-to-openapi";
import { router } from "./index";
import { charactersRouter } from "./routers/characters";
import { debugRouter } from "./routers/debug";

export const appRouter = router({
  characters: charactersRouter,
  debug: debugRouter,
});

export type AppRouter = typeof appRouter;

// Generate OpenAPI document
export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "StoryForge API",
  version: "1.0.0",
  baseUrl: "http://localhost:3001",
  docsUrl: "https://github.com/your-org/storyforge",
  tags: ["characters", "debug"],
});

import { generateOpenApiDocument } from "trpc-to-openapi";
import { allRouters, appRouter } from "./app-router.js";

export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: "StoryForge API",
  version: "1.0.0",
  baseUrl: "http://localhost:3001",
  tags: Object.keys(allRouters),
});

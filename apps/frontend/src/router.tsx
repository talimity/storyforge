import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/app-shell";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { default: CharacterLibraryPage } = await import("./pages/character-library");
          return { Component: CharacterLibraryPage };
        },
      },
      {
        path: "characters",
        lazy: async () => {
          const { default: CharacterLibraryPage } = await import("./pages/character-library");
          return { Component: CharacterLibraryPage };
        },
      },
      {
        path: "characters/create",
        lazy: async () => {
          const { default: CharacterCreatePage } = await import("./pages/character-create");
          return { Component: CharacterCreatePage };
        },
      },
      {
        path: "characters/:id/edit",
        lazy: async () => {
          const { default: CharacterEditPage } = await import("./pages/character-edit");
          return { Component: CharacterEditPage };
        },
      },
      {
        path: "scenarios",
        lazy: async () => {
          const { default: ScenarioLibraryPage } = await import("./pages/scenario-library");
          return { Component: ScenarioLibraryPage };
        },
      },
      {
        path: "scenarios/create",
        lazy: async () => {
          const { default: ScenarioCreatePage } = await import("./pages/scenario-create");
          return { Component: ScenarioCreatePage };
        },
      },
      {
        path: "scenarios/:id/edit",
        lazy: async () => {
          const { default: ScenarioEditPage } = await import("./pages/scenario-edit");
          return { Component: ScenarioEditPage };
        },
      },
      {
        path: "models",
        lazy: async () => {
          const { default: ModelsPage } = await import("./pages/models-library");
          return { Component: ModelsPage };
        },
      },
      {
        path: "lorebooks",
        lazy: async () => {
          const { default: LorebooksPage } = await import("./pages/lorebook-library");
          return { Component: LorebooksPage };
        },
      },
      {
        path: "lorebooks/create",
        lazy: async () => {
          const { default: LorebookCreatePage } = await import("./pages/lorebook-create");
          return { Component: LorebookCreatePage };
        },
      },
      {
        path: "lorebooks/:id/edit",
        lazy: async () => {
          const { default: LorebookEditPage } = await import("./pages/lorebook-edit");
          return { Component: LorebookEditPage };
        },
      },
      {
        path: "workflows",
        lazy: async () => {
          const { default: WorkflowsPage } = await import("./pages/workflow-library");
          return { Component: WorkflowsPage };
        },
      },
      {
        path: "workflows/create",
        lazy: async () => {
          const { default: WorkflowCreatePage } = await import("./pages/workflow-create");
          return { Component: WorkflowCreatePage };
        },
      },
      {
        path: "workflows/:id/edit",
        lazy: async () => {
          const { default: WorkflowEditPage } = await import("./pages/workflow-edit");
          return { Component: WorkflowEditPage };
        },
      },
      {
        path: "templates",
        lazy: async () => {
          const { default: TemplatesPage } = await import("./pages/template-library");
          return { Component: TemplatesPage };
        },
      },
      {
        path: "templates/select-task",
        lazy: async () => {
          const { default: TemplateTaskSelectPage } = await import("./pages/template-task-select");
          return { Component: TemplateTaskSelectPage };
        },
      },
      {
        path: "templates/create",
        lazy: async () => {
          const { default: TemplateCreatePage } = await import("./pages/template-create");
          return { Component: TemplateCreatePage };
        },
      },
      {
        path: "templates/:id/edit",
        lazy: async () => {
          const { default: TemplateEditPage } = await import("./pages/template-edit");
          return { Component: TemplateEditPage };
        },
      },
      {
        path: "theme-demo",
        lazy: async () => {
          const { default: ThemeDemoPage } = await import("./pages/theme-demo");
          return { Component: ThemeDemoPage };
        },
      },
    ],
  },
  // Scenario Player exists outside the normal app shell
  {
    path: "/play/:id",
    lazy: async () => {
      const { default: PlayerShell } = await import(
        "./features/scenario-player/components/player-shell"
      );
      return { Component: PlayerShell };
    },
    children: [
      {
        index: true,
        lazy: async () => {
          const { default: PlayerPage } = await import("./pages/scenario-player");
          return { Component: PlayerPage };
        },
      },
    ],
  },
]);

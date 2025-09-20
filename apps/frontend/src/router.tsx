import { createBrowserRouter } from "react-router-dom";
import { PlayerShell } from "@/features/scenario-player/components/player-shell";
import { AppShell } from "./components/app-shell";
import { CharacterCreatePage } from "./pages/character-create";
import { CharacterEditPage } from "./pages/character-edit";
import { CharacterLibraryPage } from "./pages/character-library";
import { ModelsPage } from "./pages/models-library";
import { ScenarioCreatePage } from "./pages/scenario-create";
import { ScenarioEditPage } from "./pages/scenario-edit";
import { ScenarioLibraryPage } from "./pages/scenario-library";
import { PlayerPage } from "./pages/scenario-player";
import { TemplateCreatePage } from "./pages/template-create";
import { TemplateEditPage } from "./pages/template-edit";
import { TemplatesPage } from "./pages/template-library";
import { TemplateTaskSelectPage } from "./pages/template-task-select";
import { ThemeDemoPage } from "./pages/theme-demo";
import { WorkflowCreatePage } from "./pages/workflow-create";
import { WorkflowEditPage } from "./pages/workflow-edit";
import { WorkflowsPage } from "./pages/workflow-library";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <CharacterLibraryPage />,
      },
      {
        path: "characters",
        element: <CharacterLibraryPage />,
      },
      {
        path: "characters/create",
        element: <CharacterCreatePage />,
      },
      {
        path: "characters/:id/edit",
        element: <CharacterEditPage />,
      },
      {
        path: "scenarios",
        element: <ScenarioLibraryPage />,
      },
      {
        path: "scenarios/create",
        element: <ScenarioCreatePage />,
      },
      {
        path: "scenarios/:id/edit",
        element: <ScenarioEditPage />,
      },
      {
        path: "models",
        element: <ModelsPage />,
      },
      {
        path: "workflows",
        element: <WorkflowsPage />,
      },
      {
        path: "workflows/create",
        element: <WorkflowCreatePage />,
      },
      {
        path: "workflows/:id/edit",
        element: <WorkflowEditPage />,
      },
      {
        path: "templates",
        element: <TemplatesPage />,
      },
      {
        path: "templates/select-task",
        element: <TemplateTaskSelectPage />,
      },
      {
        path: "templates/create",
        element: <TemplateCreatePage />,
      },
      {
        path: "templates/:id/edit",
        element: <TemplateEditPage />,
      },
      {
        path: "theme-demo",
        element: <ThemeDemoPage />,
      },
    ],
  },
  // Scenario Player exists outside the normal app shell
  {
    path: "/play/:id",
    element: <PlayerShell />,
    children: [
      {
        index: true,
        element: <PlayerPage />,
      },
    ],
  },
]);

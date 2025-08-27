import { createBrowserRouter } from "react-router-dom";
import { PlayerShell } from "@/components/features/player/player-shell";
import { AppShell } from "./components/app-shell";
import { AgentsPage } from "./pages/agents";
import { CharacterCreatePage } from "./pages/character-create";
import { CharacterEditPage } from "./pages/character-edit";
import { CharacterLibraryPage } from "./pages/character-library";
import { ModelsPage } from "./pages/models";
import { PlayerPage } from "./pages/player";
import { ScenarioCreatePage } from "./pages/scenario-create";
import { ScenarioEditPage } from "./pages/scenario-edit";
import { ScenarioLibraryPage } from "./pages/scenario-library";
import { SettingsPage } from "./pages/settings";
import { TemplateCreatePage } from "./pages/template-create";
import { TemplateEditPage } from "./pages/template-edit";
import { TemplatesPage } from "./pages/template-library";
import { TemplateTaskSelectPage } from "./pages/template-task-select";
import { ThemeDemoPage } from "./pages/theme-demo";

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
        path: "agents",
        element: <AgentsPage />,
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
      {
        path: "settings",
        element: <SettingsPage />,
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

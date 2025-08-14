import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { AgentsPage } from "./pages/agents";
import { CharacterCreatePage } from "./pages/character-create";
import { CharacterEditPage } from "./pages/character-edit";
import { CharacterLibraryPage } from "./pages/character-library";
import { DashboardPage } from "./pages/dashboard";
import { ModelsPage } from "./pages/models";
import { ScenarioCreatePage } from "./pages/scenario-create";
import { ScenarioLibraryPage } from "./pages/scenario-library";
import { SettingsPage } from "./pages/settings";
import { ThemeDemoPage } from "./pages/theme-demo";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "dashboard",
        element: <DashboardPage />,
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
        path: "models",
        element: <ModelsPage />,
      },
      {
        path: "agents",
        element: <AgentsPage />,
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
]);

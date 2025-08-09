import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { AgentsPage } from "./pages/agents";
import { CharactersPage } from "./pages/characters";
import { DashboardPage } from "./pages/dashboard";
import { ModelsPage } from "./pages/models";
import { ScenariosPage } from "./pages/scenarios";
import { SettingsPage } from "./pages/settings";

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
        element: <CharactersPage />,
      },
      {
        path: "scenarios",
        element: <ScenariosPage />,
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
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);

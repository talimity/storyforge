import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./components/app-shell";
import { CharactersPage } from "./pages/characters";
import { DashboardPage } from "./pages/dashboard";
import { ScenariosPage } from "./pages/scenarios";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
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
    ],
  },
]);

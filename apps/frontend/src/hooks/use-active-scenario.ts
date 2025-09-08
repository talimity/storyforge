import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { useTRPC } from "@/lib/trpc";

const ACTIVE_SCENARIO_KEY = "storyforge:activeScenario";

export function useActiveScenario() {
  const [activeScenarioId, setActiveScenarioIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_SCENARIO_KEY);
    } catch {
      return null;
    }
  });

  const setActiveScenario = useCallback((scenarioId: string | null) => {
    setActiveScenarioIdState(scenarioId);
    try {
      if (scenarioId) {
        localStorage.setItem(ACTIVE_SCENARIO_KEY, scenarioId);
      } else {
        localStorage.removeItem(ACTIVE_SCENARIO_KEY);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const clearActiveScenario = useCallback(() => {
    setActiveScenario(null);
  }, [setActiveScenario]);

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ACTIVE_SCENARIO_KEY) {
        setActiveScenarioIdState(e.newValue);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return {
    activeScenarioId,
    setActiveScenario,
    clearActiveScenario,
    hasActiveScenario: activeScenarioId !== null,
  };
}

export function useActiveScenarioWithData() {
  const trpc = useTRPC();
  const { activeScenarioId, setActiveScenario, clearActiveScenario, hasActiveScenario } =
    useActiveScenario();

  // Fetch the active scenario data if there is one
  const scenarioQuery = useQuery(
    trpc.scenarios.getById.queryOptions(
      { id: activeScenarioId || "" },
      { enabled: !!activeScenarioId }
    )
  );

  const hasValidActiveScenario = activeScenarioId && !scenarioQuery.error && scenarioQuery.data;

  return {
    activeScenarioId,
    setActiveScenario,
    clearActiveScenario,
    hasActiveScenario,
    scenarioQuery,
    hasValidActiveScenario,
  };
}

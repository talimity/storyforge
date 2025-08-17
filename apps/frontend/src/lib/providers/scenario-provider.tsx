import { createContext, type ReactNode, useContext } from "react";
import { useScenarioEnvironment } from "@/lib/hooks/use-scenario-environment";

type ScenarioCtx = ReturnType<typeof useScenarioEnvironment>;
const Ctx = createContext<ScenarioCtx | null>(null);

export function ScenarioProvider({
  scenarioId,
  children,
}: {
  scenarioId: string;
  children: ReactNode;
}) {
  const value = useScenarioEnvironment(scenarioId);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useScenarioCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScenarioCtx called outside ScenarioProvider");
  return ctx;
}

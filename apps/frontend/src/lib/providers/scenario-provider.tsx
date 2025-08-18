import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useScenarioEnvironment } from "@/lib/hooks/use-scenario-environment";

type ScenarioEnvironment = ReturnType<typeof useScenarioEnvironment>;
type ScenarioParticipant = ScenarioEnvironment["participants"][number];
type ScenarioCharacter = ScenarioEnvironment["characters"][number];

type ScenarioCtx = ScenarioEnvironment & {
  participantsById: Record<string, ScenarioParticipant>;
  charactersById: Record<string, ScenarioCharacter>;
  getCharacterByParticipantId: (
    participantId: string
  ) => ScenarioCharacter | null;
};
const Ctx = createContext<ScenarioCtx | null>(null);

export function ScenarioProvider({
  scenarioId,
  children,
}: {
  scenarioId: string;
  children: ReactNode;
}) {
  const env = useScenarioEnvironment(scenarioId);

  const participantsById = useMemo(
    () => Object.fromEntries(env.participants.map((p) => [p.id, p])),
    [env.participants]
  );
  const charactersById = useMemo(
    () => Object.fromEntries(env.characters.map((c) => [c.id, c])),
    [env.characters]
  );
  const getCharacterByParticipantId = useMemo(
    () => (participantId: string) => {
      const p = participantsById[participantId];
      return p?.characterId ? charactersById[p.characterId] : null;
    },
    [participantsById, charactersById]
  );

  return (
    <Ctx.Provider
      value={{
        ...env,
        participantsById,
        charactersById,
        getCharacterByParticipantId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useScenarioCtx() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useScenarioCtx called outside ScenarioProvider");
  return ctx;
}

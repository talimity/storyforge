import type { IntentKind, IntentStatus, TimelineTurn } from "@storyforge/contracts";
import { FaDiagramNext, FaMasksTheater } from "react-icons/fa6";
import { LuClapperboard } from "react-icons/lu";
import { RiQuillPenLine } from "react-icons/ri";

const intentKindLabels: Record<IntentKind, React.ReactNode> = {
  manual_control: <FaMasksTheater />,
  guided_control: <LuClapperboard />,
  narrative_constraint: <RiQuillPenLine />,
  continue_story: <FaDiagramNext />,
};

export interface IntentProvenanceDisplay {
  intentId: string;
  label: React.ReactNode;
  status: IntentStatus;
  sequence: number;
  count: number;
  connectTop: boolean;
  connectBottom: boolean;
  description: string | null;
  targetParticipantId: string | null;
}

export function getIntentProvenanceDisplay(
  turn: TimelineTurn,
  prevTurn: TimelineTurn | null,
  nextTurn: TimelineTurn | null
): IntentProvenanceDisplay | null {
  const provenance = turn.provenance;
  if (!provenance) return null;

  const prev = prevTurn?.provenance;
  const next = nextTurn?.provenance;
  const seq = provenance.effectSequence;

  const connectTopFromPrev =
    prev?.intentId === provenance.intentId && prev.effectSequence === seq - 1;
  const connectBottomToNext =
    next?.intentId === provenance.intentId && next.effectSequence === seq + 1;

  const connectTop = connectTopFromPrev || seq > 0;
  const connectBottom = connectBottomToNext || seq < Math.max(provenance.effectCount - 1, 0);

  return {
    intentId: provenance.intentId,
    label: seq === 0 ? intentKindLabels[provenance.intentKind] : null,
    status: provenance.intentStatus,
    sequence: seq,
    count: provenance.effectCount,
    connectTop,
    connectBottom,
    description: provenance.inputText?.trim() || null,
    targetParticipantId: provenance.targetParticipantId,
  };
}

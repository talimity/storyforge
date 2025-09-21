import type { Virtualizer, VirtualizerOptions } from "@tanstack/react-virtual";
import { useCallback, useLayoutEffect, useRef } from "react";
import { useScenarioContext } from "@/features/scenario-player/providers/scenario-provider";
import { useScenarioPlayerStore } from "@/features/scenario-player/stores/scenario-player-store";

type Args<TScrollEl extends Element | Window, TItemEl extends Element> = {
  virtualizer: Virtualizer<TScrollEl, TItemEl>;
  turns: { id: string }[];
};

// credit @zcfan via https://github.com/TanStack/virtual/discussions/195#discussioncomment-13906325
export function useTimelineKeepBottomDistance<
  TScrollEl extends Element | Window,
  TItemEl extends Element,
>({ virtualizer, turns }: Args<TScrollEl, TItemEl>) {
  const { scenario } = useScenarioContext();
  const previewLeafTurnId = useScenarioPlayerStore((s) => s.previewLeafTurnId);
  const timelineLeafTurnId = previewLeafTurnId ?? scenario.anchorTurnId;

  const prevLeafTurnIdRef = useRef<string | undefined>(timelineLeafTurnId);
  const prevBottomDistanceRef = useRef(0);
  const prevFirstTurnIdRef = useRef<string | undefined>(undefined);

  const handleChange: VirtualizerOptions<TScrollEl, TItemEl>["onChange"] = useCallback(
    (instance: Virtualizer<TScrollEl, TItemEl>, sync: boolean) => {
      if (!sync) return;
      console.log("useTimelineKeepBottomDistance -> handleChange");
      prevBottomDistanceRef.current = instance.getTotalSize() - (instance.scrollOffset ?? 0);
    },
    []
  );

  const keepBottomDistance = useCallback(() => {
    console.log("useTimelineKeepBottomDistance -> keepBottomDistance");
    const totalSize = virtualizer.getTotalSize();
    virtualizer.scrollToOffset(totalSize - prevBottomDistanceRef.current, {
      align: "start",
    });
    // NOTE: This line is required to make "position keepping" works in my real project,
    //       But it seems fine here without it.
    //       I don't have time to dig into it, but very curious about the reason,
    //       plz comment if you find out.
    virtualizer.scrollOffset = totalSize - prevBottomDistanceRef.current;
  }, [virtualizer]);

  const firstTurnId = turns.at(0)?.id;
  useLayoutEffect(() => {
    let skipEffect = false;
    if (prevFirstTurnIdRef.current === firstTurnId) skipEffect = true; // do not scroll if first turn is the same (no new data added to top)
    if (prevLeafTurnIdRef.current !== timelineLeafTurnId) skipEffect = true; // do not scroll if the branch has changed, distances may be different
    prevFirstTurnIdRef.current = firstTurnId;
    if (!skipEffect) {
      console.log("useTimelineKeepBottomDistance -> useLayoutEffect");
      keepBottomDistance();
    } else {
      prevLeafTurnIdRef.current = timelineLeafTurnId;
      console.log("useTimelineKeepBottomDistance -> useLayoutEffect -> skip effect");
    }
  }, [keepBottomDistance, firstTurnId, timelineLeafTurnId]);

  return { handleChange };
}

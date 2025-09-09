import type { Virtualizer, VirtualizerOptions } from "@tanstack/react-virtual";
import { useCallback, useLayoutEffect, useRef } from "react";

type Args<TScrollEl extends Element | Window, TItemEl extends Element> = {
  virtualizer: Virtualizer<TScrollEl, TItemEl>;
  turns: { id: string }[];
};

// credit @zcfan via https://github.com/TanStack/virtual/discussions/195#discussioncomment-13906325
export function useTimelineKeepBottomDistance<
  TScrollEl extends Element | Window,
  TItemEl extends Element,
>({ virtualizer, turns }: Args<TScrollEl, TItemEl>) {
  const prevBottomDistanceRef = useRef(0);

  const handleChange: VirtualizerOptions<TScrollEl, TItemEl>["onChange"] = useCallback(
    (instance: Virtualizer<TScrollEl, TItemEl>, sync: boolean) => {
      if (!sync) return;
      prevBottomDistanceRef.current = instance.getTotalSize() - (instance.scrollOffset ?? 0);
    },
    []
  );

  const keepBottomDistance = useCallback(() => {
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
    console.log("Keep bottom distance effect");
    void firstTurnId;
    keepBottomDistance();
  }, [keepBottomDistance, firstTurnId]);

  return { handleChange };
}

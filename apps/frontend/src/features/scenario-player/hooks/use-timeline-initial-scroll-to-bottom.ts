import type { Virtualizer } from "@tanstack/react-virtual";
import { useLayoutEffect, useRef } from "react";

type Args<TScrollEl extends Element | Window, TItemEl extends Element> = {
  virtualizer: Virtualizer<TScrollEl, TItemEl>;
  turns: unknown[];
};

export function useTimelineInitialScrollToBottom<
  TScrollEl extends Element | Window,
  TItemEl extends Element,
>({ virtualizer, turns }: Args<TScrollEl, TItemEl>) {
  // scroll to bottom on initial data load
  const initialDataReceivedRef = useRef(false);
  useLayoutEffect(() => {
    if (turns.length === 0 || initialDataReceivedRef.current) {
      console.log("useTimelineInitialScrollToBottom -> skipped");
      return;
    }

    // don't scroll if scenario only has one turn
    if (turns.length > 1) {
      console.log("useTimelineInitialScrollToBottom -> scroll to end");
      const count = virtualizer.options.count;
      virtualizer.scrollToIndex(count - 1, { align: "end", behavior: "smooth" });
    }

    setTimeout(() => {
      console.log("useTimelineInitialScrollToBottom -> set initialDataReceivedRef true");
      initialDataReceivedRef.current = true;
    }, 100);
  }, [turns.length, virtualizer]);

  return initialDataReceivedRef.current;
}

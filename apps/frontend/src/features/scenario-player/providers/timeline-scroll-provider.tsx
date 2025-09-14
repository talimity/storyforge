import { createContext, useContext, useMemo } from "react";

type TimelineScrollContextValue = { scrollToEnd: () => void; shouldAutoFollow: () => boolean };
const TimelineScrollContext = createContext<TimelineScrollContextValue | null>(null);
export function TimelineScrollProvider({
  value,
  children,
}: {
  value: TimelineScrollContextValue;
  children: React.ReactNode;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: memoize by function identity
  const v = useMemo(() => value, [value.scrollToEnd, value.shouldAutoFollow]);
  return <TimelineScrollContext.Provider value={v}>{children}</TimelineScrollContext.Provider>;
}
export function useTimelineScroll() {
  const ctx = useContext(TimelineScrollContext);
  if (!ctx) throw new Error("useTimelineScroll called outside TimelineScrollProvider");
  return ctx;
}

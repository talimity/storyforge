import { Badge, Flex, Icon, Spinner, Text } from "@chakra-ui/react";
import type { ChapterSummaryStatus } from "@storyforge/contracts";
import type { ElementType } from "react";
import { LuCheck, LuCircle, LuCircleAlert, LuCircleDashed, LuRefreshCcw } from "react-icons/lu";

type ChapterSummaryStatusBadgeProps = {
  status?: ChapterSummaryStatus;
  showText?: boolean;
};

const STATUS_LABEL: Record<ChapterSummaryStatus["state"], string | null> = {
  missing: "No Summary",
  current: "Ongoing Chapter",
  ready: "Summarized",
  stale: "Stale Summary",
  running: "Summarizing",
  error: "Error",
};

const STATUS_ICON: Partial<Record<ChapterSummaryStatus["state"], ElementType>> = {
  ready: LuCheck,
  stale: LuRefreshCcw,
  error: LuCircleAlert,
  missing: LuCircleDashed,
};

const STATUS_PALETTE: Record<ChapterSummaryStatus["state"], string> = {
  missing: "orange",
  current: "neutral",
  ready: "green",
  stale: "orange",
  running: "accent",
  error: "red",
};

export function ChapterSummaryStatusBadge(props: ChapterSummaryStatusBadgeProps) {
  const { status, showText = true } = props;
  if (!status) return null;

  const palette = STATUS_PALETTE[status.state] ?? "neutral";
  const label = STATUS_LABEL[status.state];

  if (!label) return null;

  if (status.state === "running") {
    return (
      <Badge colorPalette={palette} size="xs" variant="solid">
        <Flex align="center" gap="1">
          <Spinner size="xs" />
          {showText ? <Text fontSize="2xs">{label}</Text> : null}
        </Flex>
      </Badge>
    );
  }

  const IconComponent = STATUS_ICON[status.state] ?? LuCircle;

  return (
    <Badge colorPalette={palette} size="xs" variant="subtle">
      <Flex align="center" gap="1">
        <Icon asChild boxSize="3">
          <IconComponent />
        </Icon>
        {showText ? <Text fontSize="2xs">{label}</Text> : null}
      </Flex>
    </Badge>
  );
}

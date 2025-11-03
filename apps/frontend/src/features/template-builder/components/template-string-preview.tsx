import { Mark, type MarkProps, Text, type TextProps, VStack } from "@chakra-ui/react";
import { tokenizeTemplateString } from "@storyforge/prompt-rendering";
import { Fragment } from "react";

type TemplateSegment = ReturnType<typeof tokenizeTemplateString>["segments"][number];

type HighlightConfig = {
  variable?: MarkProps;
  blockStart?: MarkProps;
  blockElse?: MarkProps;
  blockEnd?: MarkProps;
};

type StylableSegmentKind = Exclude<TemplateSegment["kind"], "text">;
type HighlightMap = Record<StylableSegmentKind, MarkProps>;

type PreviewTextProps = Omit<TextProps, "children">;

interface TemplateStringPreviewProps extends PreviewTextProps {
  value: string;
  fallback?: string;
  highlight?: HighlightConfig;
  showErrors?: boolean;
  errorLimit?: number;
}

const defaultHighlight: HighlightMap = {
  variable: { css: { bg: "bg.emphasized", color: "content.emphasized" }, fontFamily: "mono" },
  blockStart: { css: { bg: "blue.subtle", color: "blue.fg" }, fontFamily: "mono" },
  blockElse: { css: { bg: "purple.subtle", color: "purple.fg" }, fontFamily: "mono" },
  blockEnd: { css: { bg: "blue.subtle", color: "blue.fg" }, fontFamily: "mono" },
};

export function TemplateStringPreview(props: TemplateStringPreviewProps) {
  const {
    value,
    fallback,
    highlight,
    showErrors = true,
    errorLimit = 1,
    fontSize = "sm",
    whiteSpace = "break-spaces",
    wordBreak = "break-word",
    ...textProps
  } = props;

  const result = tokenizeTemplateString(value);
  const highlightStyles: HighlightMap = {
    variable: { ...defaultHighlight.variable, ...highlight?.variable },
    blockStart: { ...defaultHighlight.blockStart, ...highlight?.blockStart },
    blockElse: { ...defaultHighlight.blockElse, ...highlight?.blockElse },
    blockEnd: { ...defaultHighlight.blockEnd, ...highlight?.blockEnd },
  };

  const shouldShowFallback = value.length === 0 && typeof fallback === "string";
  const contentSegments = shouldShowFallback ? [] : result.segments;
  const errorMessages = showErrors ? result.errors.slice(0, errorLimit) : [];

  return (
    <VStack align="stretch" gap={errorMessages.length > 0 ? 1 : 0} width="full">
      <Text fontSize={fontSize} whiteSpace={whiteSpace} wordBreak={wordBreak} {...textProps}>
        {shouldShowFallback ? fallback : renderSegments(contentSegments, highlightStyles)}
      </Text>

      {errorMessages.length > 0 && (
        <Text fontSize="xs" color="fg.error">
          {errorMessages.join(" • ")}
        </Text>
      )}
    </VStack>
  );
}

function renderSegments(segments: TemplateSegment[], styles: HighlightMap) {
  const seen: Record<string, number> = {};

  return segments.map((segment) => {
    const baseKey = `${segment.kind}:${segment.content}`;
    const occurrences = seen[baseKey] ?? 0;
    seen[baseKey] = occurrences + 1;
    const key = `${baseKey}:${occurrences}`;

    if (segment.kind === "text") {
      return <Fragment key={key}>{segment.content}</Fragment>;
    }

    return (
      <Mark key={key} {...styles[segment.kind]} whiteSpace="pre-wrap">
        {segment.content}
      </Mark>
    );
  });
}

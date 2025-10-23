import { type ComponentPropsWithoutRef, memo, useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import {
  selectFontSize,
  usePlayerPreferencesStore,
} from "@/features/scenario-player/stores/player-preferences-store";
import { closeIncompleteMarkdown } from "@/lib/markdown/close-incomplete-markdown";
import { rehypeDialogue } from "@/lib/markdown/rehype-dialogue";
import { rehypeSoftBreakParagraphs } from "@/lib/markdown/rehype-soft-break-paragraphs";
import { richTextSanitizeSchema } from "@/lib/markdown/sanitize-schema";
import { Prose } from "./prose";

const markdownComponents: Components = {
  img: ({ node: _node, ...props }) => (
    <img
      alt={props.alt || "Embedded image"}
      key={props.src}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      {...props}
    />
  ),
};

type ProseProps = ComponentPropsWithoutRef<typeof Prose>;

export interface StreamingMarkdownProps extends Omit<ProseProps, "children"> {
  text: string;
  dialogueAuthorId?: string | null;
  dialogueTintColor?: string | null;
  allowBasicHtml?: boolean;
  paragraphizeSoftBreaks?: boolean;
}

export const StreamingMarkdown = memo(function StreamingMarkdown({
  text,
  dialogueAuthorId = null,
  dialogueTintColor = null,
  allowBasicHtml = true,
  paragraphizeSoftBreaks = true,
  ...rest
}: StreamingMarkdownProps) {
  const stableText = useMemo(() => closeIncompleteMarkdown(text), [text]);

  const rehypePlugins = useMemo(() => {
    const plugins: PluggableList = [[rehypeSanitize, richTextSanitizeSchema]];

    if (paragraphizeSoftBreaks) {
      plugins.push(rehypeSoftBreakParagraphs);
    }

    plugins.push([rehypeDialogue, { authorId: dialogueAuthorId }]);

    if (allowBasicHtml) {
      plugins.unshift(rehypeRaw);
    }

    return plugins;
  }, [allowBasicHtml, dialogueAuthorId, paragraphizeSoftBreaks]);

  // remark-breaks converts soft line breaks (single \n) into <br />
  // This fixes models that use single line breaks for new lines
  // instead of double line breaks for new paragraphs
  const remarkPlugins = useMemo(() => [remarkGfm, remarkBreaks], []);
  const fontSize = usePlayerPreferencesStore(selectFontSize);

  return (
    <Prose maxW="fit-content" fontSize={fontSize} {...rest}>
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
        skipHtml={!allowBasicHtml}
      >
        {stableText}
      </ReactMarkdown>
    </Prose>
  );
});

import type { ComponentPropsWithoutRef } from "react";
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

const BASE_REHYPE_PLUGINS: PluggableList = [[rehypeSanitize, richTextSanitizeSchema]];
const BASE_REMARK_PLUGINS: PluggableList = [remarkGfm, remarkBreaks];

export function StreamingMarkdown({
  text,
  dialogueAuthorId = null,
  dialogueTintColor = null,
  allowBasicHtml = true,
  paragraphizeSoftBreaks = true,
  ...rest
}: StreamingMarkdownProps) {
  const stableText = closeIncompleteMarkdown(text);
  const fontSize = usePlayerPreferencesStore(selectFontSize);

  const rehypePlugins: PluggableList = [
    ...(allowBasicHtml ? [rehypeRaw] : []),
    ...BASE_REHYPE_PLUGINS,
    ...(paragraphizeSoftBreaks ? [rehypeSoftBreakParagraphs] : []),
    [rehypeDialogue, { authorId: dialogueAuthorId }],
  ];

  return (
    <Prose maxW="fit-content" fontSize={fontSize} {...rest}>
      <ReactMarkdown
        remarkPlugins={BASE_REMARK_PLUGINS}
        rehypePlugins={rehypePlugins}
        components={markdownComponents}
        skipHtml={!allowBasicHtml}
      >
        {stableText}
      </ReactMarkdown>
    </Prose>
  );
}

export default StreamingMarkdown;

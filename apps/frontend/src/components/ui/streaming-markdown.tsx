import { type ComponentPropsWithoutRef, memo, useMemo } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { PluggableList } from "unified";
import { closeIncompleteMarkdown } from "@/lib/markdown/close-incomplete-markdown";
import { rehypeDialogue } from "@/lib/markdown/rehype-dialogue";
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
  allowBasicHtml?: boolean;
}

export const StreamingMarkdown = memo(function StreamingMarkdown({
  text,
  dialogueAuthorId = null,
  allowBasicHtml = true,
  maxW = "85ch",
  size = "lg",
  ...rest
}: StreamingMarkdownProps) {
  const stableText = useMemo(() => closeIncompleteMarkdown(text), [text]);

  const rehypePlugins = useMemo(() => {
    const plugins: PluggableList = [
      [rehypeSanitize, richTextSanitizeSchema],
      [rehypeDialogue, { authorId: dialogueAuthorId }],
    ];
    if (allowBasicHtml) {
      plugins.unshift(rehypeRaw);
    }
    return plugins;
  }, [allowBasicHtml, dialogueAuthorId]);

  const remarkPlugins = useMemo(() => [remarkGfm], []);

  return (
    <Prose maxW={maxW} size={size} {...rest}>
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

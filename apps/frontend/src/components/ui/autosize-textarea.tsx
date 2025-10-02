import { Textarea, type TextareaProps } from "@chakra-ui/react";
import TextareaAutosize, { type TextareaAutosizeProps } from "react-textarea-autosize";

export type AutosizeTextareaProps = Omit<TextareaProps, "as"> &
  TextareaAutosizeProps & { ref?: React.Ref<HTMLTextAreaElement> };

// replacement for Chakra's autosize prop as it has major issues when input gets long
export const AutosizeTextarea = (props: AutosizeTextareaProps) => {
  const { minRows = 1, maxRows = 12, minH, pb, ref, ...rest } = props;

  return (
    <Textarea
      ref={ref}
      asChild
      autoComplete="off"
      minH={minH || `${minRows}lh`}
      maxH={`${maxRows}lh`}
      pb={pb}
    >
      <TextareaAutosize {...rest} />
    </Textarea>
  );
};

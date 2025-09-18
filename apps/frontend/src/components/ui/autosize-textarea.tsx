import { Textarea, type TextareaProps } from "@chakra-ui/react";
import TextareaAutosize, { type TextareaAutosizeProps } from "react-textarea-autosize";

type AutosizeTextareaProps = Omit<TextareaProps, "as"> &
  TextareaAutosizeProps & { ref?: React.RefObject<HTMLTextAreaElement> };

// replacement for Chakra's autosize prop as it has major issues when input gets long
export const AutosizeTextarea = (props: AutosizeTextareaProps) => {
  const { minRows = 1, maxRows = 12, ref, ...rest } = props;

  return (
    <Textarea ref={ref} asChild autoComplete="off" minH={`${minRows}lh`} maxH={`${maxRows}lh`}>
      <TextareaAutosize {...rest} />
    </Textarea>
  );
};

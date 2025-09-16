import { Textarea, type TextareaProps } from "@chakra-ui/react";
import { forwardRef } from "react";
import TextareaAutosize, { type TextareaAutosizeProps } from "react-textarea-autosize";

type AutosizeTextareaProps = Omit<TextareaProps, "as"> & TextareaAutosizeProps;

// replacement for Chakra's autosize prop as it has major issues when input gets long
export const AutosizeTextarea = forwardRef<HTMLTextAreaElement, AutosizeTextareaProps>(
  (props, ref) => {
    const { minRows = 1, maxRows = 12, ...rest } = props;

    return (
      <Textarea ref={ref} asChild autoComplete="off" minH={`${minRows}lh`} maxH={`${maxRows}lh`}>
        <TextareaAutosize {...rest} />
      </Textarea>
    );
  }
);

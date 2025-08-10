import {
  Dialog as ChakraDialog,
  createOverlay,
  Portal,
} from "@chakra-ui/react";
import * as React from "react";
import { CloseButton } from "./close-button";

interface DialogContentProps extends ChakraDialog.ContentProps {
  portalled?: boolean;
  portalRef?: React.RefObject<HTMLElement>;
  backdrop?: boolean;
}

export const DialogContent = React.forwardRef<
  HTMLDivElement,
  DialogContentProps
>(function DialogContent(props, ref) {
  const {
    children,
    portalled = true,
    portalRef,
    backdrop = true,
    ...rest
  } = props;

  return (
    <Portal disabled={!portalled} container={portalRef}>
      {backdrop && <ChakraDialog.Backdrop />}
      <ChakraDialog.Positioner>
        <ChakraDialog.Content ref={ref} {...rest} asChild={false}>
          {children}
        </ChakraDialog.Content>
      </ChakraDialog.Positioner>
    </Portal>
  );
});

export const DialogCloseTrigger = React.forwardRef<
  HTMLButtonElement,
  ChakraDialog.CloseTriggerProps
>(function DialogCloseTrigger(props, ref) {
  return (
    <ChakraDialog.CloseTrigger
      position="absolute"
      top="2"
      insetEnd="2"
      {...props}
      asChild
    >
      <CloseButton size="sm" ref={ref}>
        {props.children}
      </CloseButton>
    </ChakraDialog.CloseTrigger>
  );
});

export const Dialog = {
  Root: ChakraDialog.Root,
  Content: DialogContent,
  CloseTrigger: DialogCloseTrigger,
  Backdrop: ChakraDialog.Backdrop,
  Positioner: ChakraDialog.Positioner,
  Header: ChakraDialog.Header,
  Body: ChakraDialog.Body,
  Footer: ChakraDialog.Footer,
  Title: ChakraDialog.Title,
  Description: ChakraDialog.Description,
  Trigger: ChakraDialog.Trigger,
  ActionTrigger: ChakraDialog.ActionTrigger,
};

type ManagedDialogProps = DialogContentProps & {
  title?: string;
  body?: React.ReactNode;
  content?: React.ReactNode;
  actions?: React.ReactNode;
};
export const dialog = createOverlay<ManagedDialogProps>((props) => {
  const {
    title,
    body,
    content,
    actions,
    portalled = true,
    portalRef,
    backdrop = true,
    ...rest
  } = props;

  return (
    <ChakraDialog.Root>
      <DialogContent
        portalled={portalled}
        portalRef={portalRef}
        backdrop={backdrop}
        {...rest}
      >
        {title && <ChakraDialog.Header>{title}</ChakraDialog.Header>}
        {content || <ChakraDialog.Body>{body}</ChakraDialog.Body>}
        {actions && <ChakraDialog.Footer>{actions}</ChakraDialog.Footer>}
        <DialogCloseTrigger />
      </DialogContent>
    </ChakraDialog.Root>
  );
});

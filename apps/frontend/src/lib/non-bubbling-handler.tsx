/**
 * Given an event handler, returns a new handler that stops the event from
 * bubbling up the DOM tree. This is useful for preventing unintended event
 * propagation when menus or dialogs are used within components that have their
 * own event handlers.
 */
export function nonBubblingHandler(
  callback: (event?: React.MouseEvent | React.KeyboardEvent) => void
) {
  return (event: React.MouseEvent | React.KeyboardEvent) => {
    event?.stopPropagation();
    callback(event);
  };
}

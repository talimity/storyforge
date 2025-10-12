import { AutosizeTextarea } from "@/components/ui";
import {
  selectEditedContentForTurn,
  useTurnUiStore,
} from "@/features/scenario-player/stores/turn-ui-store";

interface TurnEditorProps {
  turnId: string;
  originalContent: string;
}

export function TurnEditor({ turnId, originalContent }: TurnEditorProps) {
  const editedContent = useTurnUiStore(selectEditedContentForTurn(turnId, originalContent));
  const setEditedContent = useTurnUiStore((state) => state.setEditedContent);

  return (
    <AutosizeTextarea
      value={editedContent}
      onChange={(event) => setEditedContent(turnId, event.target.value)}
      size="lg"
      minRows={2}
      maxRows={50}
      autoFocus
    />
  );
}

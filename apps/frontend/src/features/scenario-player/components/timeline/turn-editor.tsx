import { AutosizeTextarea } from "@/components/ui";
import {
  selectFontSize,
  usePlayerPreferencesStore,
} from "@/features/scenario-player/stores/player-preferences-store";
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
  const fontSizeToken = usePlayerPreferencesStore(selectFontSize);
  const textAreaSize = fontSizeToken === "2xl" ? "xl" : fontSizeToken;

  return (
    <AutosizeTextarea
      value={editedContent}
      onChange={(event) => setEditedContent(turnId, event.target.value)}
      size={textAreaSize}
      // for some reason chakra size token do not change textarea font size at
      // the same scale as other text.
      css={{ fontSize: "1em" }}
      minRows={2}
      maxRows={50}
      autoFocus
    />
  );
}

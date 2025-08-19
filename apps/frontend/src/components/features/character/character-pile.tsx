import { type AvatarRoot, Menu, Portal } from "@chakra-ui/react";
import { CharacterListItem } from "@/components/features/character/character-list-item";
import { Avatar, AvatarGroup } from "@/components/ui";
import { getApiUrl } from "@/lib/trpc";

interface CharacterPileCharacter {
  id: string;
  name: string;
  avatarPath: string | null;
}

export interface CharacterPileProps
  extends React.ComponentProps<typeof AvatarGroup> {
  characters: CharacterPileCharacter[];
  maxAvatars?: number;
  onCharacterClick?: (character: CharacterPileCharacter) => void;
  children?: React.ReactNode;
  layerStyle?: React.ComponentProps<typeof AvatarRoot>["layerStyle"];
}

function partition<T>(arr: T[], max: number) {
  const items = [];
  const overflow = [];
  for (const item of arr) {
    if (items.length < max) {
      items.push(item);
    } else {
      overflow.push(item);
    }
  }
  return { items, overflow };
}

export function CharacterPile({
  characters,
  maxAvatars = 6,
  onCharacterClick,
  children,
  layerStyle,
  ...avatarGroupProps
}: CharacterPileProps) {
  const { items, overflow } = partition(characters, maxAvatars);

  return (
    <AvatarGroup {...avatarGroupProps}>
      {items.map((character) => (
        <Avatar
          layerStyle={layerStyle}
          key={character.id}
          name={character.name}
          src={
            character.avatarPath ? getApiUrl(character.avatarPath) : undefined
          }
          onClick={
            onCharacterClick ? () => onCharacterClick(character) : undefined
          }
          cursor={onCharacterClick ? "pointer" : undefined}
        />
      ))}

      {overflow.length > 0 && (
        <Menu.Root positioning={{ placement: "bottom" }}>
          <Menu.Trigger rounded="md" focusRing="mixed">
            <Avatar
              layerStyle={layerStyle}
              fallback={`+${overflow.length}`}
              variant="outline"
            />
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content layerStyle={layerStyle}>
                {overflow.map((character) => (
                  <Menu.Item
                    layerStyle={layerStyle}
                    my={1}
                    key={character.id}
                    value={character.id}
                    onClick={
                      onCharacterClick
                        ? () => onCharacterClick(character)
                        : undefined
                    }
                  >
                    <CharacterListItem character={character} />
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
      {children}
    </AvatarGroup>
  );
}

import { HStack, Text } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";
import { Avatar } from "@/components/ui/index";

import { getApiUrl } from "@/lib/get-api-url";

interface CharacterListItemCharacter {
  id: string;
  name: string;
  avatarPath: string | null;
}

export interface CharacterListItemProps extends ComponentProps<typeof Avatar> {
  character: CharacterListItemCharacter;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}

export function CharacterListItem({
  character,
  children,
  layerStyle = "surface",
  size = "md",
  ...avatarProps
}: CharacterListItemProps) {
  return (
    <HStack gap={3} alignItems="center" minWidth={0}>
      <Avatar
        shape="rounded"
        size={size}
        layerStyle={layerStyle}
        {...avatarProps}
        name={character.name}
        src={character.avatarPath ? getApiUrl(character.avatarPath) : undefined}
      />
      <Text
        fontWeight="medium"
        truncate
        flex={1}
        minWidth={0}
        fontSize={size === "lg" ? "md" : "sm"}
      >
        {character.name}
      </Text>
      {children}
    </HStack>
  );
}

import { Center, Flex, Text } from "@chakra-ui/react";
import { RiQuillPenAiFill } from "react-icons/ri";

interface LogoProps {
  collapsed?: boolean;
}

export function Logo({ collapsed = false }: LogoProps) {
  return (
    <Flex
      as="header"
      align="center"
      gap="3"
      px={collapsed ? "3" : "5"}
      py="3"
      borderBottomWidth="1px"
      data-testid="logo"
    >
      <Center color="content" flexShrink={0} boxSize="10" transition="all 0.2s">
        <RiQuillPenAiFill size={collapsed ? 20 : 20} />
      </Center>
      {!collapsed && (
        <Text
          color="content.emphasized"
          fontWeight="semibold"
          fontSize="2xl"
          fontFamily="heading"
          userSelect="none"
        >
          StoryForge
        </Text>
      )}
    </Flex>
  );
}

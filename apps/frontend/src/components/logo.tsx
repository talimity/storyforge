import { Center, Flex, Text } from "@chakra-ui/react";
import { LuScroll } from "react-icons/lu";

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
      <Center
        color="content"
        flexShrink={0}
        boxSize={"10"}
        transition="all 0.2s"
      >
        <LuScroll size={collapsed ? 20 : 20} />
      </Center>
      {!collapsed && (
        <Text
          color="content.emphasized"
          fontWeight="semibold"
          fontSize="2xl"
          fontFamily={"heading"}
        >
          StoryForge
        </Text>
      )}
    </Flex>
  );
}

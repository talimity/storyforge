import { Box, Text } from "@chakra-ui/react";
import { memo } from "react";

export const SceneWidget = memo(function SceneWidget() {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" mb={2}>
        SCENE
      </Text>
      <Text fontSize="xs" color="content.muted">
        Scene controls will appear here
      </Text>
    </Box>
  );
});

import { Box, Text } from "@chakra-ui/react";
import { memo } from "react";

export const ToolsWidget = memo(function ToolsWidget() {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" mb={2}>
        TOOLS
      </Text>
      <Text fontSize="xs" color="content.muted">
        Chapter management will appear here
      </Text>
    </Box>
  );
});

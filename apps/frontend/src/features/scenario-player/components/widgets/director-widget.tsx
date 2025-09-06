import { Box, Text } from "@chakra-ui/react";
import { memo } from "react";

export const DirectorWidget = memo(function DirectorWidget() {
  return (
    <Box>
      <Text fontSize="xs" fontWeight="semibold" mb={2}>
        DIRECTOR
      </Text>
      <Text fontSize="xs" color="content.muted">
        Generation settings will appear here
      </Text>
    </Box>
  );
});

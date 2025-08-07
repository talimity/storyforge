# StoryForge Frontend - Package Notes

## Frontend Design System Guidelines
- **Vite + React**: Use Vite for fast development and React for UI components.
- **Chakra UI v3**: Utilize Chakra UI v3 components for consistent styling and theming.
- **tRPC**: Use tRPC for type-safe API calls between frontend and backend.
- **Zustand**: Use Zustand for managing shared state across components.

## `chakra-ui` tool
You can invoke the `chakra-ui` Model Context Protocol tool to quickly look up documentation for Chakra UI v3, including:
- Component props
- Example usage
- Theming options
- Theme customization, given design tokens

Use this tool whenever you need to reference Chakra UI documentation or examples, especially if you are not sure absolutely sure how to achieve a specific design.

## Playwright Testing Tool

The `mcp__playwright__*` tools provide browser automation capabilities for testing the frontend application. These tools can:

**Core Interactions**:
- `browser_navigate` - Navigate to URLs (e.g., localhost:5173)
- `browser_click` - Click elements using references from page snapshots
- `browser_take_screenshot` - Capture visual state for debugging/verification
- `browser_snapshot` - Get accessibility tree with element references
- `browser_resize` - Test responsive layouts at different screen sizes

**Advanced Testing**:
- `browser_type` - Fill forms and input fields
- `browser_file_upload` - Test file upload functionality
- `browser_evaluate` - Execute JavaScript for complex interactions
- `browser_network_requests` - Monitor API calls and network activity
- `browser_console_messages` - Check for JavaScript errors

**Use Cases**:
- Verify UI components render correctly
- Test responsive design behavior
- End-to-end testing of user workflows (e.g., character import)
- Debug layout issues with visual screenshots
- Validate navigation and routing

The dev server should be running on localhost:5173 for testing. Use these tools to verify functionality after implementing new features or fixing bugs.

**Note**: Do not run `browser_install` - it will fail on NixOS but is not required. The Playwright tools work without browser installation.

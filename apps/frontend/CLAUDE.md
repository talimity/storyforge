# StoryForge Frontend - Package Notes

## Frontend Guidelines
- **Vite + React**: Use Vite for fast development and React for UI components.
- **Chakra UI v3**: Utilize Chakra UI v3 components for consistent styling and theming.
- **tRPC**: Use tRPC for type-safe API calls between frontend and backend.
- **Zustand**: Use Zustand for managing shared state across components.
- **Icons**: Use `react-icons` for iconography; prefer Lucide (`react-icons/lu`) when possible.
  - Use the `react-icons-mcp` tool to look up icons from Lucide or other icon sets.
  - Note: Lucide icons tend to be named after what they literally display ('Edit' -> 'LuPencil', 'Home' -> 'LuHouse')
  
When looking for a component, use wrappers in @/components/ui for common UI elements like button, checkbox, empty state, field, input, radio, select, switch, toaster, tooltip. These apply theming tweaks needed for consistency. The API is identical to the equivalent Chakra UI component.

For any other component, import from @chakra-ui/react directly. This includes most layout primitives.
  
## Design System

### Surfaces (Containers)
Apply these to containers, cards, etc. to lift them off the page background. Avoid nesting them.

- `layerStyle="surface"` - Light parchment background with border and shadow (default)
- `layerStyle="contrast"` - Dark leather background with accent
  - Only use `contrast` for extremely important elements, like the player input widget in the scenario player.
  - Only one `contrast` layer should be used per page. Many pages will not need it.
  - Controls on this surface should use `colorPalette="accent"`. Inputs also need `variant="onContrast"` to improve visibility.

### Color Tokens
#### Surface Colors (Backgrounds)
- `bg="surface"` - [default] Default background
- `bg="surface.subtle"` - Slightly lighter (sidebars, modals, cards which don't warrant elevation with `layerStyle`)
- `bg="surface.muted"` - Slightly darker (hover states, alternating rows)
- `bg="surface.emphasized"` - Darker still (selected states)

#### Content Colors (Text/Foreground)
- `color="content"` - [default] General text for readability
- `color="content.muted"` - Secondary/helper text
- `color="content.subtle"` - Between default and muted
- `color="content.emphasized"` - Headers, important text

#### Borders
- `borderColor="surface.border"` - [default] Borders on light
- `borderColor="surfaceContrast.border"` - Borders on dark

#### On Dark Surfaces
- Use `surfaceContrast` and `contentContrast` with same modifiers
- Example: `color="contentContrast.muted"` for secondary text on the dark surface

### Buttons/Controls Color Palettes
- `colorPalette="neutral"` - [default] Meta actions (Cancel, Settings, Back)
- `colorPalette="primary"` - Main user flow actions (Create, Save, Continue)
- `colorPalette="secondary"` - Alternative paths (Share, Export, Templates)  
- `colorPalette="accent"` - Highlighted actions (Level Up) OR controls on dark surfaces
- `colorPalette="red"` - Destructive (Delete, Remove)

### Button Variants (Hierarchy)
- `variant="solid"` - Primary importance (Confirm)
- `variant="outline"` - Secondary importance (Save Draft)
- `variant="ghost"` - Tertiary/dismissive 

### Form Inputs
- On `surface`: `<Input />` (default)
- On `surfaceContrast`: `<Input variant="onContrast" />`

## Research tools
**IMPORTANT: You must always delegate research tasks to an agent.**

### `react-icons-mcp` tool
An agent can invoke the `react-icons-mcp` Model Context Protocol tool to quickly look up icons from the `react-icons` library. Unless you already see an icon in the code, you should ask an agent to look up icons for you instead of guessing.

### `chakra-ui` tool
An agent can invoke the `chakra-ui` Model Context Protocol tool to quickly look up documentation for Chakra UI v3, including:
- Component props
- Example usage
- Theming options
- Theme customization, given design tokens
- v2 to v3 migration guides (note: it's unlikely you'll need this as we started with v3)

Use this tool often whenever you need to reference Chakra UI documentation or examples, especially if you are not sure absolutely sure how to achieve a specific design.

### Playwright Testing Tool
An agent can invoke the `mcp__playwright__*` tools to access browser automation capabilities for testing the frontend application.

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

The Playwright tool is a bit slow so it's best to only use it after making significant changes or to verify complex interactions.

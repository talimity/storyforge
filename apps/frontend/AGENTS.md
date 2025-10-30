# StoryForge Frontend - Package Notes

This file provides guidance to AI agents when working with frontend code.

## Frontend Stack
- **Framework:** React 19 with Vite, with React Compiler
- **Component/Theming Library:** Chakra UI (v3)
- **Data Fetching:** Tanstack Query plugin for tRPC
- **Form Management:** Tanstack Form
- **State Management:** Zustand
- **Parsing/Validation:** Zod
- **Icons**: react-icons
  - Prefer Lucide (`react-icons/lu`) when possible.
  
When looking for a component, use wrappers in @/components/ui for common UI elements like button, checkbox, empty state, field, input, radio, select, switch, toaster, tooltip.

For any other component, import from @chakra-ui/react directly. This includes most layout primitives.

## Code Style and Design Guidelines
- 🚫 **Do not manually use `useMemo`, `useCallback`, or `React.memo`**. React Compiler memoizes components and functions called during render automatically.
- For forms, use Tanstack Form. As this is a newer library, always look for existing examples (`apps/frontend/src/features/lorebooks/components/lorebook-form.tsx` is a good reference).
- Avoid prop drilling as much as possible. Use Zustand with selectors, or Context when rerendering is not a concern.
- Aggressively break down large components into smaller ones and extract code from component bodies into separate functions, modules, or hooks.
- 🚫 Avoid coalescing to null (`?? null`). The only time you need to do this is when constructing API payloads for tRPC procedures that don't allow `undefined`.
  - Use optional properties for any frontend-internal data structures, as the TS ergonomics are better.
  - Remove this pattern from existing code when you see it.
- Guidelines from root [AGENTS.md](../../AGENTS.md) apply here as well.

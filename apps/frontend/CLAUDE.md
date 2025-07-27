# StoryForge Frontend - Package Notes

This document outlines the React SPA that serves as the frontend for the StoryForge character roleplaying application.

## Routes (Port 8080 dev server)
- `/` - Home dashboard
- `/characters` - Character management
- `/scenarios` - Scenario listing 
- `/scenario/:id` - Active scenario interface (full-screen)
- `/lorebooks` - Lorebook management
- `/agents` - Agent configuration (future AI settings)
- `/api` - API configuration (future LLM endpoints)

## Architecture
- **Framework**: Vite + React + TypeScript + React Router
- **UI**: shadcn/ui + Tailwind CSS (extensive component library in `components/ui/`)
- **State**: TanStack Query for server state + React hooks
- **API**: Custom fetch client (`services/api.ts`) pointing to backend:3001

## Key Components
- **Layout**: Sidebar navigation with conditional header (hidden on active scenarios)
- **Scenario Components**: Specialized UI in `components/scenario/` for gameplay
- **API Hooks**: React Query hooks in `hooks/api/` for data fetching
- **Services**: Typed API clients in `services/` for each entity

## Development Notes
- Uses `@/` path alias for clean imports
- Mobile-responsive with useIsMobile hook
- ApiError class for structured error handling
- Layout adapts for active scenario (full-screen experience)
- All UI components follow shadcn/ui patterns

**Important**: The frontend should be as dumb as possible. Push as much logic and state to the backend as feasible. This frontend may be completely replaced in the future, so keep it simple and focused on presentation.

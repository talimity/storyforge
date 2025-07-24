# StoryForge - AI Tabletop Roleplay Engine

## Project Overview

StoryForge is an LLM-powered character roleplaying application that reimagines AI chat interfaces as a tabletop RPG experience. Unlike traditional 1-on-1 AI chat apps, StoryForge positions the user as a director/dungeon master orchestrating multi-character scenarios rather than being locked into a single character role.

## Core Vision

- **Multi-character scenarios**: Load and manage multiple characters using standard character card formats
- **Flexible role management**: User can play any character, multiple characters, or remain in director mode
- **Agentic narrative engine**: Each turn uses specialized AI agents (Planner, Screenplay, Prose) for rich, structured storytelling
- **Event-driven narratives**: User-prompted twists, challenges, and scenario management

## Technical Constraints & Choices

### Platform Philosophy
- **Single-user desktop application** - Not a hosted web service
- **Bring your own AI models** - Users can run their own LLMs or use cloud APIs
- **No real-time multiplayer** - Focus on single-player experience with potential for future LAN/mobile
- **TypeScript/Node.js focused** - Consistent language across stack for rapid development

### Technology Stack
- **Frontend**: Vite + React + TypeScript + shadcn/ui + Tailwind CSS
- **Backend**: Fastify + TypeScript (chosen over Express for modern async/await patterns)
- **Shared**: TypeScript types package for consistent interfaces
- **Build**: pnpm workspace monorepo for dependency management

### Future Deployment
- **Electron packaging** for cross-platform desktop distribution
- **LAN mobile access** - Backend serves on `0.0.0.0` to allow phones/tablets to connect over local network
- **Mobile UI considerations** - Responsive design for tablet/phone access to the same interface

## Architecture

```
storyforge/
├── apps/
│   ├── frontend/          # Vite React app (port 8080)
│   │   ├── src/
│   │   │   ├── components/    # UI components
│   │   │   │   └── ui/        # Design system components
│   │   │   ├── pages/         # Route pages
│   │   │   ├── hooks/         # React hooks
│   │   │   └── types/         # Frontend-specific types
│   │   └── package.json
│   └── backend/           # Fastify API server (port 3001)
│       ├── src/
│       │   ├── server.ts      # Main server entry
│       │   ├── routes/        # API route handlers
│       │   ├── agents/        # AI agent implementations
│       │   └── services/      # Business logic
│       └── package.json
├── packages/
│   └── shared/            # Shared TypeScript types
│       └── src/types.ts
├── electron/              # Future Electron wrapper
└── package.json           # Monorepo root
```

### Key Endpoints
- `/health` - Server health check
- `/api/scenarios` - Scenario CRUD operations
- `/api/characters` - Character management
- `/api/lorebooks` - Lore/worldbuilding data
- `/api/agents/*` - AI agent processing endpoints

## Development Guidelines

### Code Style
- **Kebab-case for files** - Use kebab-case for file names and directories
- **TypeScript strict mode** - Do not use `any` and avoid type assertions; use `pnpm typecheck` to check types
- **Minimal comments** - Code should be self-documenting; comment only to explain why, not what
- **Component composition** - Build UIs from small, reusable components
- **Functional patterns preferred** - Favor pure functions and immutable data
- **Conventional commit messages** - Use conventional commits

### Architecture Patterns
- **API-first design** - Backend provides JSON APIs, frontend consumes them
- **Shared types** - Use the shared package to ensure type safety across apps
- **Error boundaries** - Implement proper error handling in React and Fastify
- **Validation** - Validate all inputs using Zod or similar schema validation

### AI Agent Design
- **Separation of concerns** - Each agent (Planner, Screenplay, Prose) has a specific role
- **Context management** - Carefully manage token usage and context windows
- **Streaming responses** - Implement streaming for real-time narrative generation
- **Error resilience** - Handle AI model failures gracefully

### File Organization
- **Feature-based folders** - Group related components, hooks, and types together
- **Absolute imports** - Use `@/` path mapping for clean imports
- **Consistent naming** - PascalCase for components, camelCase for functions, kebab-case for files

### Testing Strategy
- **Type safety as first defense** - Rely on TypeScript for catching errors
- **Integration tests** - Focus on API endpoint testing
- **Component testing** - Test user interactions and state management
- **Manual testing** - Extensive manual testing of AI narrative flows

## Development Commands

```bash
# Install dependencies
pnpm install

# Start both frontend and backend
pnpm dev

# Start individual apps
pnpm dev:frontend
pnpm dev:backend

# Type checking
pnpm typecheck

# Build for production
pnpm build
```

## Mobile/LAN Access

The backend is configured to accept connections from any device on the local network. Once running:

1. Find your computer's IP address
2. On mobile device, navigate to `http://[computer-ip]:8080`
3. Full application functionality available on mobile browsers

This enables tablet/phone interfaces for players while the main computer acts as the "server" running the AI processing.

### Current Implementation Status
- ✅ UI framework and component library (shadcn/ui + Tailwind CSS)
- ✅ Monorepo structure with pnpm
- ✅ Responsive design with mobile detection
- ✅ Basic Fastify API server
- ❌ Backend API connections
- ❌ AI agent integration
- ❌ Data persistence
- ❌ Character import/export (SillyTavern format planned)

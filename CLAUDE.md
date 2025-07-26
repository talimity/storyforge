# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

StoryForge is an LLM-powered character roleplaying application that reimagines AI chat interfaces as a tabletop RPG experience. Unlike traditional 1-on-1 AI chat apps, StoryForge positions the user as a director/dungeon master orchestrating multi-character scenarios rather than being locked into a single character role. Agentic narrative engine uses specialized AI agents (Planner, Screenplay, Prose, etc.) to take advantage of the strengths of different models and prompt structures.

### Vision
- **Multi-character scenarios**: Load and manage multiple characters using SillyTavern .png character cards
- **Flexible role management**: User can play any character, multiple characters, or remain in director mode
- **Agentic narrative engine**: Turns are managed by a narrative engine that handles character actions, scene management, and AI interactions
- **Event-driven narratives**: User-prompted twists, challenges, and character actions drive the story forward

### Technical Choices
- **Single-user desktop application** - Not a hosted web service
- **Bring your own AI models** - Players run their own LLMs locally or use cloud APIs
- **No real-time multiplayer** - Focus on single-player experience with potential for future LAN/mobile
- **TypeScript/Node.js focused** - Consistent language across stack for rapid development

## Build & Test Commands
```bash
# Install dependencies
pnpm i

# eslint, tsc, prettier
pnpm lint
pnpm typecheck
pnpm format

# Build
pnpm build
```

## Stack
- **Frontend**: Vite + React + TypeScript + shadcn/ui + Tailwind CSS
- **Backend**: Fastify + TypeScript + Drizzle ORM + SQLite
- **Monorepo**: pnpm workspaces

## Monorepo Structure
```
storyforge/
├── apps/
│   ├── frontend/               # Vite React app (:8080)
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   │   └── ui/         # Design system components
│   │   │   ├── pages/          # Route pages
│   │   │   ├── hooks/          # React hooks
│   │   │   └── types/          # Frontend-specific types
│   └── backend/                # Fastify API server (:3001)
│       ├── src/
│       │   ├── data/           # Static data (currently, mocks)
│       │   ├── db/             # Database client and models
│       │   │   ├── migrations/ # Drizzle-Kit migrations
│       │   │   └── schema/     # Drizzle models
│       │   ├── repositories/   # Data access layer
│       │   ├── routes/         # API route handlers
│       │   ├── agents/         # AI agent implementations
│       │   └── services/       # Business logic
├── packages/                   # Shared packages
│   └── shared/                 # Currently, just TypeScript types
└── electron/                   # Future Electron wrapper (not yet implemented)
```

## Code Style Guidelines

- **TypeScript**: Strict typing, no implicit any, no unused locals
- **Naming conventions**:
  - Files: kebab-case
  - Identifiers: camelCase for functions/variables, PascalCase for classes/components
- **Code structure**: Follow a clear, consistent folder structure;
  - Group related files together (components, hooks, types)
  - Use absolute imports with `@/` path mapping
  - Put common isomorphic utilities in `packages/shared`

### Comments Policy

#### Core Principles

Strongly tend towards not using any comments.
- **Self-documenting code first** - Use clear naming and structure instead of comments
- **Comments must add value** - If removing the comment doesn't lose information, it shouldn't exist
- **Explain WHY, not WHAT** - Focus on business logic and non-obvious relationships
- **Maintenance risk** - Comments can become outdated; prefer refactoring over commenting

## Current Implementation Status
- ✅ UI framework and component library (shadcn/ui + Tailwind CSS)
- ✅ Monorepo structure with pnpm
- ✅ Responsive design with mobile detection
- ✅ Basic Fastify API server
- ❌ Backend API connections
- ❌ AI agent integration
- ❌ Data persistence
- ❌ Character import/export (SillyTavern format planned)

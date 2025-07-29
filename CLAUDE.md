# StoryForge - AI Tabletop Roleplay Engine

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About

StoryForge is an LLM-powered character roleplaying application that reimagines AI chat interfaces as a tabletop RPG experience. Unlike traditional 1-on-1 AI chat apps, StoryForge positions the user as a director/dungeon master orchestrating multi-character scenarios rather than being locked into a single character role. Agentic narrative engine uses specialized AI agents (Planner, Screenplay, Prose, etc.) to take advantage of the strengths of different models and prompt structures.

### Vision
- **Multi-character scenarios**: Load and manage multiple characters using TavernCard v2 .png character cards
- **Flexible role management**: User can play any character, multiple characters, or remain in director mode
- **Agentic narrative engine**: Turns are managed by a narrative engine that handles character actions, scene management, and AI interactions
- **Event-driven narratives**: User-prompted twists, challenges, and character actions drive the story forward

### Technical Choices
- **Single-user desktop application** - Not a hosted web service
- **Bring your own AI models** - Players run their own LLMs locally or use cloud APIs
- **No real-time multiplayer** - Focus on single-player experience with potential for future LAN/mobile
- **TypeScript/Node.js focused** - Consistent language across stack for rapid development

## Current Status

Very early, still in the design phase. The codebase is not yet functional, and the architecture and core concepts are being defined.

- ✅ UI framework and component library (shadcn/ui + Tailwind CSS)
- ✅ Monorepo structure with pnpm
- ✅ Basic Fastify API server
- ✅ SQLite persistence layer
- ❌ Character import / browsing / management
- ❌ Scenario creation / play
- ❌ LLM inference interface
- ❌ AI agent architecture

Important: Most of the code in this repository is scaffolding. Types, interfaces, and models for Character, Scenario, Turn, etc. are placeholder interfaces generated for the UI mockup. None of these types will be used in the final codebase, and they should not be used as a reference. As features are implemented, remove the placeholder types from /packages/shared/src/types/placeholders.ts and create individual files for each feature.

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

# Dev servers
# ⚠️ IMPORTANT: If you use `pnpm dev` it will block your terminal.
# If you need to start the servers in the background, you MUST use the `devctl` helper:
devctl start      # Starts frontend/backend in the background
devctl status     # "running" | "stopped"
curl http://localhost:3001/health # Interact with the frontend or backend for your task
devctl logs 100   # Show last 100 lines of logs (default 30)
devctl restart    # Restart both dev servers (this should not be necessary in most cases)
devctl stop       # Stop both dev servers
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

Strongly tend towards not using any comments.
- **Self-documenting code first** - Use clear naming and structure instead of comments
- **Comments must add value** - If removing the comment doesn't lose information, it shouldn't exist
- **Explain WHY, not WHAT** - Focus on business logic and non-obvious relationships
- **Maintenance risk** - Comments can become outdated; prefer refactoring over commenting

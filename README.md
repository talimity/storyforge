# DirectorMaxx

An AI-powered tabletop-style roleplay application that moves beyond traditional 1-on-1 AI chat toward a director/dungeon master experience.

## Project Status

**Phase 1 Complete**: Basic infrastructure and CRUD operations
- ✅ TypeScript + Express backend with SQLite database
- ✅ React frontend with mobile-responsive design
- ✅ Character library management
- ✅ Scenario creation and management
- ✅ Basic turn system with director controls
- ✅ Database schema for multi-agent architecture

**Next Phase**: Agentic narrative engine implementation

## Quick Start

```bash
# Install dependencies
pnpm install

# Initialize database
pnpm db:migrate

# Start development servers (both backend and frontend)
pnpm dev

# Or start individually:
pnpm dev:server  # Backend on :3001
pnpm dev:client  # Frontend on :3000
```

## Architecture

### Backend (`src/server/`)
- **Express API** with TypeScript and ES modules
- **SQLite database** with comprehensive schema for characters, scenarios, turns, and future agentic features
- **RESTful endpoints** for all CRUD operations
- **Multi-layer turn storage** (planner, screenplay, prose outputs)

### Frontend (`src/client/`)
- **React 18** with TypeScript and React Router
- **Mobile-responsive design** with custom CSS (no framework dependencies)
- **Character library** for importing and managing character cards
- **Scenario management** with character assignment
- **Turn-based play interface** with director controls

### Database Schema
- `characters` - Character library with SillyTavern card compatibility
- `scenarios` - Scenario definitions with settings and context
- `scenario_characters` - Many-to-many character assignments
- `turns` - Multi-agent turn storage (planner/screenplay/prose outputs)
- `api_configs` - LLM provider configurations
- `agent_configs` - Agent-specific settings and prompts
- `lorebooks` - World-building and context injection

## Key Features

### Current
- **Character Library**: Import/create characters with detailed personalities
- **Scenario Management**: Create scenarios and assign characters
- **Director Mode**: Control narrative flow and introduce events
- **Turn History**: View and edit generated content
- **Mobile Responsive**: Works on desktop and mobile devices

### Planned (Agentic System)
- **Multi-Agent Generation**: Planner → Screenplay → Prose pipeline
- **Context Management**: Efficient token usage with layered context
- **Quality Control**: Ranking agents and parallel generation
- **Visual Storytelling**: Dynamic backgrounds and character sprites
- **Advanced Director Tools**: Event injection, character control, narrative branching

## Development

The project uses boring, reliable technologies:
- **Backend**: Node.js 20, TypeScript, Express, SQLite
- **Frontend**: React 18, TypeScript, Vite
- **Package Manager**: pnpm
- **Environment**: Nix flake with direnv

### Scripts
- `pnpm dev` - Start both servers
- `pnpm build` - Build for production
- `pnpm db:migrate` - Initialize/update database schema

## Design Philosophy

This application prioritizes:
1. **Director Experience**: User as storyteller/DM rather than character participant
2. **Agentic Quality**: Multi-agent approach to solve AI roleplay consistency issues
3. **Immersive UI**: Visual storytelling elements beyond basic chat interfaces
4. **Flexible Roles**: Seamless switching between director and character participation
5. **Efficient Context**: Smart token usage through specialized agent contexts

See `DESIGN.md` for detailed project vision and technical approach.
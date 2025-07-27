# StoryForge Backend - Package Notes

## API Routes (Port 3001)
- **Characters**: `/api/characters` - Full CRUD
- **Scenarios**: `/api/scenarios` - CRUD + turn management at `/api/scenarios/:id/turns`
- **Lorebooks**: `/api/lorebooks` - CRUD + entry management at `/api/lorebooks/:id/entries`
- **Health**: `/health` - Simple health check

## Data Layer
- **ORM**: Drizzle with SQLite (local file: `data/storyforge.db`)
- **Migrations**: Auto-generated in `src/db/migrations/`
- **Schema**: Defined in `src/db/schema/` (characters, scenarios, turns, lorebooks)
- **Repository Pattern**: Each model has dedicated repository in `src/repositories/`

## Key Implementation Notes
- Scenarios support character relationships and turn sequences with agent data
- Lorebooks use trigger-based entry system with enable/disable states
- Turn data includes optional agent outputs (planner, screenplay, prose)
- CORS configured for frontend dev servers (5173, 8080)
- All routes use structured error handling with proper HTTP status codes

## Database Seeding
- Run `pnpm db:seed` to populate with mock data
- Mock data available in `src/data/mockData.ts`

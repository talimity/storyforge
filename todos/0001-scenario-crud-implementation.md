# Scenario CRUD Implementation Plan

## Overview

This document outlines the implementation plan for adding a complete `scenario` tRPC router, repository, contracts, and CRUD handlers to StoryForge. The implementation will follow established patterns from the existing character implementation while adding new functionality for character assignment management with soft deletes.

## Requirements Analysis

### Core Requirements
- ✅ Full CRUD operations for scenarios (create, read, update, delete)
- ✅ Character assignment/unassignment to scenarios
- ✅ Soft deletes for character unassignments (preserve scenario coherence)
- ✅ Keep tRPC handlers thin (validation via Zod, data access via repository)
- ✅ Follow existing codebase patterns and conventions
- ✅ Create feature branch and make conventional commits per phase
- ❌ Turn CRUD (deferred to scenario runtime engine)

### Key Considerations
- **Character Assignment Persistence**: Once a character participates in a scenario, their assignment record must be preserved even after "removal" to maintain future narrative state
- **Soft Delete Implementation**: New pattern for the codebase - reuse existing records rather than creating new ones
- **Relationship Management**: One-to-one relationship between scenario-character pairs via junction table (reuse records)
- **Status Management**: Scenarios have simple active/archived status
- **Repository Filtering**: Repositories must handle inactive entity filtering, not router code

## Database Schema Design

### Primary Scenario Table
```sql
CREATE TABLE scenarios (
    id TEXT PRIMARY KEY,           -- CUID2
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'archived'
    settings TEXT NOT NULL DEFAULT '{}',   -- JSON settings object
    metadata TEXT DEFAULT '{}',            -- JSON metadata object
    created_at INTEGER NOT NULL,          -- Timestamp
    updated_at INTEGER NOT NULL           -- Timestamp
);
```

### Scenario-Character Junction Table
```sql
CREATE TABLE scenario_characters (
    id TEXT PRIMARY KEY,                   -- CUID2
    scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    role TEXT,                             -- Optional character role in scenario
    order_index INTEGER NOT NULL DEFAULT 0, -- Display/turn order
    assigned_at INTEGER NOT NULL,         -- When character was first assigned
    unassigned_at INTEGER,                 -- When character was unassigned (NULL if active)
    created_at INTEGER NOT NULL,          -- Timestamp
    updated_at INTEGER NOT NULL,          -- Timestamp
    UNIQUE(scenario_id, character_id)      -- Only one record per scenario-character pair
);
```

## API Contract Design

### Core Schemas
```typescript
// Input schemas
export const scenarioIdSchema = z.object({
  id: z.string().min(1)
});

export const createScenarioSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000),
  status: z.enum(['active', 'archived']).default('active'),
  settings: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  characterIds: z.array(z.string()).default([]) // Initial character assignments
});

export const updateScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  status: z.enum(['active', 'archived']).optional(),
  settings: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional()
});

// Character assignment schemas
export const assignCharacterSchema = z.object({
  scenarioId: z.string().min(1),
  characterId: z.string().min(1),
  role: z.string().optional(),
  orderIndex: z.number().int().min(0).optional()
});

export const unassignCharacterSchema = z.object({
  scenarioId: z.string().min(1),
  characterId: z.string().min(1)
});

export const reorderCharactersSchema = z.object({
  scenarioId: z.string().min(1),
  characterOrders: z.array(z.object({
    characterId: z.string().min(1),
    orderIndex: z.number().int().min(0)
  }))
});

// Output schemas
export const scenarioCharacterAssignmentSchema = z.object({
  id: z.string(),
  scenarioId: z.string(),
  characterId: z.string(),
  role: z.string().nullish(),
  orderIndex: z.number(),
  assignedAt: z.date(),
  unassignedAt: z.date().nullish(),
  isActive: z.boolean(), // Computed: unassignedAt === null
  character: characterSchema // Populated character data
});

export const scenarioSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  status: z.enum(['active', 'archived']),
  settings: z.record(z.unknown()),
  metadata: z.record(z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date()
});

export const scenarioWithCharactersSchema = scenarioSchema.extend({
  characters: z.array(scenarioCharacterAssignmentSchema)
});

export const scenariosListResponseSchema = z.object({
  scenarios: z.array(scenarioSchema)
});
```

## Repository Design

### ScenarioRepository Class
```typescript
export class ScenarioRepository extends BaseRepository<typeof scenarios> {
  // Standard CRUD (inherited from BaseRepository)
  // + Custom methods:
  
  async findByIdWithCharacters(id: string, includeInactive?: boolean): Promise<ScenarioWithCharacters | undefined>
  async findByStatus(status: ScenarioStatus): Promise<Scenario[]>
  async createWithCharacters(data: CreateScenarioData): Promise<ScenarioWithCharacters>
  
  // Character assignment management
  async assignCharacter(scenarioId: string, characterId: string, options?: AssignCharacterOptions): Promise<ScenarioCharacterAssignment>
  async unassignCharacter(scenarioId: string, characterId: string): Promise<boolean>
  async getAssignedCharacters(scenarioId: string, includeInactive?: boolean): Promise<ScenarioCharacterAssignment[]>
  async isCharacterAssigned(scenarioId: string, characterId: string): Promise<boolean>
  async reorderCharacters(scenarioId: string, characterOrders: CharacterOrder[]): Promise<void>
}
```

### ScenarioCharacterRepository Class
```typescript
export class ScenarioCharacterRepository extends BaseRepository<typeof scenarioCharacters> {
  async findByScenarioId(scenarioId: string, includeInactive?: boolean): Promise<ScenarioCharacterAssignment[]>
  async findByCharacterId(characterId: string, includeInactive?: boolean): Promise<ScenarioCharacterAssignment[]>
  async findAssignment(scenarioId: string, characterId: string): Promise<ScenarioCharacterAssignment | undefined>
  async softUnassign(scenarioId: string, characterId: string): Promise<boolean>
  async reassign(scenarioId: string, characterId: string): Promise<ScenarioCharacterAssignment>
}
```

## tRPC Router Design

### Scenario Router Procedures
```typescript
export const scenariosRouter = router({
  // Standard CRUD
  list: publicProcedure
    .meta({ openapi: { method: "GET", path: "/api/scenarios", tags: ["scenarios"] } })
    .input(z.object({ status: z.enum(['active', 'archived']).optional() }))
    .output(scenariosListResponseSchema)
    .query(async ({ input }) => { /* implementation */ }),

  getById: publicProcedure
    .meta({ openapi: { method: "GET", path: "/api/scenarios/{id}", tags: ["scenarios"] } })
    .input(scenarioIdSchema)
    .output(scenarioWithCharactersSchema)
    .query(async ({ input }) => { /* implementation */ }),

  create: publicProcedure
    .meta({ openapi: { method: "POST", path: "/api/scenarios", tags: ["scenarios"] } })
    .input(createScenarioSchema)
    .output(scenarioWithCharactersSchema)
    .mutation(async ({ input }) => { /* implementation */ }),

  update: publicProcedure
    .meta({ openapi: { method: "PUT", path: "/api/scenarios/{id}", tags: ["scenarios"] } })
    .input(updateScenarioSchema)
    .output(scenarioSchema)
    .mutation(async ({ input }) => { /* implementation */ }),

  delete: publicProcedure
    .meta({ openapi: { method: "DELETE", path: "/api/scenarios/{id}", tags: ["scenarios"] } })
    .input(scenarioIdSchema)
    .output(z.void())
    .mutation(async ({ input }) => { /* implementation */ }),

  // Character assignment management
  assignCharacter: publicProcedure
    .meta({ openapi: { method: "POST", path: "/api/scenarios/{scenarioId}/characters/{characterId}", tags: ["scenarios"] } })
    .input(assignCharacterSchema)
    .output(scenarioCharacterAssignmentSchema)
    .mutation(async ({ input }) => { /* implementation */ }),

  unassignCharacter: publicProcedure
    .meta({ openapi: { method: "DELETE", path: "/api/scenarios/{scenarioId}/characters/{characterId}", tags: ["scenarios"] } })
    .input(unassignCharacterSchema)
    .output(z.void())
    .mutation(async ({ input }) => { /* implementation */ }),

  reorderCharacters: publicProcedure
    .meta({ openapi: { method: "PUT", path: "/api/scenarios/{scenarioId}/characters/order", tags: ["scenarios"] } })
    .input(reorderCharactersSchema)
    .output(z.void())
    .mutation(async ({ input }) => { /* implementation */ }),

});
```

## Implementation Tasks

### Phase 1: Setup & Database Schema
- [ ] **Task 1.1**: Create feature branch for scenario implementation
  - Create branch: `git checkout -b feature/scenario-crud`
  - All subsequent work should be committed to this branch
- [ ] **Task 1.2**: Create scenario database schema (`apps/backend/src/db/schema/scenarios.ts`)
  - Define scenarios table with simplified status (active/archived)
  - Remove creator/creator_notes fields
  - Include proper type definitions and constraints
  - Add to schema index exports
- [ ] **Task 1.3**: Create scenario-characters junction table schema (`apps/backend/src/db/schema/scenario-characters.ts`)
  - Define junction table with unique constraint on (scenario_id, character_id)
  - Remove status field - use unassigned_at NULL/not-NULL instead
  - Include proper foreign key relationships
- [ ] **Task 1.4**: Generate and test database migration
  - Run `pnpm db:generate` to create migration files
  - Test migration up/down scenarios
  - Verify constraints work correctly
- [ ] **Task 1.5**: Commit Phase 1 changes
  - Conventional commit: `feat(db): add scenario and scenario_characters tables`

### Phase 2: API Contracts
- [ ] **Task 2.1**: Create scenario contracts (`packages/api/src/contracts/scenario.ts`)
  - Define simplified input schemas (remove creator fields, simplify status)
  - Define output schemas (scenario, with-characters, assignments)
  - Remove getCharacterHistory contract
  - Include proper type inference exports
- [ ] **Task 2.2**: Export scenario contracts (`packages/api/src/index.ts`)
  - Add all scenario-related exports
  - Ensure consistent naming conventions
- [ ] **Task 2.3**: Update API package build
  - Run `pnpm build` in packages/api to generate types
  - Verify type exports work correctly in consuming applications
- [ ] **Task 2.4**: Commit Phase 2 changes
  - Conventional commit: `feat(api): add scenario API contracts and types`

### Phase 3: Repository Layer
- [ ] **Task 3.1**: Create ScenarioRepository (`apps/backend/src/shelf/scenario/scenario.repository.ts`)
  - Extend BaseRepository with scenarios table
  - Implement standard CRUD operations
  - Add custom finder methods (by status, with characters)
  - Ensure getAssignedCharacters defaults to excluding inactive (unassigned_at IS NULL)
- [ ] **Task 3.2**: Create ScenarioCharacterRepository (`apps/backend/src/shelf/scenario/scenario-character.repository.ts`)
  - Extend BaseRepository with scenarioCharacters table
  - Implement record reuse pattern (find existing, clear unassigned_at)
  - Add relationship query methods that default to active characters only
  - All queries should filter on unassigned_at IS NULL unless includeInactive=true
- [ ] **Task 3.3**: Add character assignment methods to ScenarioRepository
  - Implement assignCharacter() with record reuse logic and transaction support
  - Implement unassignCharacter() setting unassigned_at timestamp
  - Implement reorderCharacters() with batch updates
- [ ] **Task 3.4**: Create repository barrel export (`apps/backend/src/shelf/scenario/index.ts`)
  - Export singleton repository instances
  - Follow existing conventions from character module
- [ ] **Task 3.5**: Commit Phase 3 changes
  - Conventional commit: `feat(repo): add scenario repositories with record reuse pattern`

### Phase 4: Data Transformation Layer
- [ ] **Task 4.1**: Create scenario transformation utilities (`apps/backend/src/shelf/scenario/scenario.transforms.ts`)
  - Implement toScenario() function (DB -> API type conversion)
  - Implement toScenarioWithCharacters() function
  - Implement toScenarioCharacterAssignment() function with isActive computed field
  - Handle JSON field parsing and date conversions
- [ ] **Task 4.2**: Add validation utilities
  - Create character assignment validation helpers
  - Implement business rule validators (no complex status transitions)
- [ ] **Task 4.3**: Commit Phase 4 changes
  - Conventional commit: `feat(transform): add scenario data transformation layer`

### Phase 5: tRPC Router Implementation
- [ ] **Task 5.1**: Create scenarios tRPC router (`apps/backend/src/trpc/routers/scenarios.ts`)
  - Implement all standard CRUD procedures with simplified status handling
  - Add OpenAPI metadata for all endpoints
  - Include proper error handling and validation
  - Ensure NO manual filtering of inactive entities in router code
- [ ] **Task 5.2**: Add character assignment procedures to scenarios router
  - Implement assignCharacter procedure (with record reuse)
  - Implement unassignCharacter procedure (set unassigned_at)
  - Implement reorderCharacters procedure
- [ ] **Task 5.3**: Register scenarios router (`apps/backend/src/trpc/app-router.ts`)
  - Add scenarios router to main app router
  - Verify router exports correctly
- [ ] **Task 5.4**: Update tRPC exports (`apps/backend/src/trpc/index.ts`)
  - Export scenarios router for potential direct usage
  - Maintain consistency with existing exports
- [ ] **Task 5.5**: Commit Phase 5 changes
  - Conventional commit: `feat(api): add scenario tRPC router with character assignment`

### Phase 6: Integration & Testing
- [ ] **Task 6.1**: Test repository layer
  - Test all CRUD operations
  - Test character assignment/unassignment with record reuse
  - Test soft delete functionality (unassigned_at timestamps)
  - Test transaction handling for complex operations
  - Verify repository filtering excludes inactive by default
- [ ] **Task 6.2**: Test tRPC integration
  - Test all tRPC procedures via development server
  - Verify OpenAPI endpoint generation
  - Test error handling and validation
  - Test character assignment workflows
  - Verify router never manually filters inactive entities
- [ ] **Task 6.3**: Verify type safety
  - Run `pnpm typecheck` to ensure no type errors
  - Verify all imports resolve correctly
  - Test type inference across the full stack
- [ ] **Task 6.4**: Commit Phase 6 changes
  - Conventional commit: `test: add scenario integration testing and validation`

### Phase 7: Documentation & Cleanup
- [ ] **Task 7.1**: Update CLAUDE.md with scenario patterns
  - Document new soft delete conventions (record reuse pattern)
  - Update status tracking patterns (simplified active/archived)
  - Note repository filtering requirements
  - Document the narrative state preservation rationale
- [ ] **Task 7.2**: Code review and refactoring
  - Ensure consistency with existing codebase patterns
  - Add any missing error handling
- [ ] **Task 7.3**: Run quality checks
  - Execute `pnpm check` to verify lint and typecheck
  - Fix any code quality issues
  - Ensure all new code follows established conventions
- [ ] **Task 7.4**: Final commit and branch preparation
  - Conventional commit: `docs: update CLAUDE.md with scenario patterns and cleanup`
  - Branch ready for PR: `feature/scenario-crud`

## Technical Considerations

### Soft Delete Implementation
This will be the first implementation of soft deletes in the codebase. Key considerations:
- **Timestamp Pattern**: Use `unassigned_at` timestamp field (NULL = active, timestamp = inactive)
- **Record Reuse**: Only one record per scenario-character pair, reuse by clearing `unassigned_at`
- **Query Filtering**: Repositories default to `WHERE unassigned_at IS NULL` unless `includeInactive=true`
- **Future Narrative State**: This pattern preserves space for character mutations specific to scenarios
- **Router Responsibility**: tRPC routers must never manually filter - rely on repository layer

### Character Assignment Business Rules
- **One Record Per Pair**: Only one scenario_characters record per scenario-character combination ever
- **Record Reuse**: Assignment -> unassignment -> reassignment of same character reuses the same database record
- **Preserve Assignment History**: Records are never hard-deleted to preserve potential narrative state
- **Order Management**: Characters maintain order within scenarios for turn management
- **Role Flexibility**: Optional role field for future turn management features

### Performance Considerations
- **Junction Table Indexes**: Ensure efficient queries for scenario-character lookups
- **Status Filtering**: Add appropriate indexes for status-based queries
- **Batch Operations**: Character reordering should update multiple records efficiently
- **Transaction Usage**: Complex operations involving multiple tables should use transactions

### Error Handling Patterns
- **Character Not Found**: Return appropriate 404 errors for missing characters/scenarios
- **Assignment Conflicts**: Return 409 for duplicate assignment attempts on active characters
- **Status Transitions**: Simple active/archived transitions only
- **Soft Delete Logic**: Handle attempts to assign already-assigned characters by reusing existing record

## Success Criteria
- [ ] All scenario CRUD operations work correctly via tRPC
- [ ] Character assignment/unassignment preserves scenario coherence through soft deletes
- [ ] OpenAPI endpoints generate correctly for REST access
- [ ] Type safety maintained throughout the full stack
- [ ] Performance is acceptable for expected usage patterns
- [ ] Code follows established patterns and conventions
- [ ] All tests pass and quality checks succeed

## Implementation Workflow

### Git Branch Strategy
- **Feature Branch**: `feature/scenario-crud`
- **Conventional Commits**: Each phase should result in one conventional commit
- **Branch Management**: All work done on feature branch, ready for PR after Phase 7

### Commit Messages by Phase
1. `feat(db): add scenario and scenario_characters tables`
2. `feat(api): add scenario API contracts and types`
3. `feat(repo): add scenario repositories with record reuse pattern`
4. `feat(transform): add scenario data transformation layer`
5. `feat(api): add scenario tRPC router with character assignment`
6. `test: add scenario integration testing and validation`
7. `docs: update CLAUDE.md with scenario patterns and cleanup`

This comprehensive implementation will establish scenarios as first-class entities in StoryForge with full CRUD capabilities and sophisticated character assignment management that preserves scenario coherence and future narrative state through a record reuse pattern.

# Scenario CRUD Refactoring

## Overview

This document outlines a comprehensive refactoring of the scenario CRUD implementation to address code quality issues identified in the initial implementation. The refactoring focuses on removing redundant code, consolidating repository logic, improving error handling consistency, and simplifying data transformations.

## Issues Identified

1. **Redundant Validators**: `ScenarioValidators` class duplicates Zod validation and violates "no classes with only static members" rule
2. **Duplicate Repository Logic**: Character assignment logic exists in both `ScenarioRepository` and `ScenarioCharacterRepository`
3. **JSON Serialization in Router**: Router handles database storage details that should be in repository layer
4. **Complex Transform Functions**: Unnecessary duplication in transformation utilities
5. **Inconsistent Error Handling**: Mix of throwing errors vs returning boolean success indicators
6. **Type Safety Issues**: Some transform functions work with loose types instead of actual query return types

## Refactoring Strategy

### Phase 1: Remove Redundant Validation System
**Goal**: Eliminate custom validation since Zod schemas already handle all validation needs

#### Tasks:
1. **Remove validator files**
   - Delete `apps/backend/src/library/scenario/scenario.validators.ts`
   - Update `apps/backend/src/library/scenario/index.ts` to remove validator exports

2. **Update router to rely on Zod validation**
   - Remove all `ScenarioValidators` imports and usage from `apps/backend/src/trpc/routers/scenarios.ts`
   - Remove `assertValid()` calls - let Zod's parse handle validation
   - Remove custom validation logic for role, character orders, etc.

3. **Clean up validation-related types**
   - Remove `ValidationResult` type export
   - Remove `assertValid` and `throwValidationError` utilities

### Phase 2: Consolidate Repository Architecture
**Goal**: Move all character assignment logic to `ScenarioCharacterRepository` and eliminate duplication

#### Tasks:
1. **Move character assignment methods to ScenarioCharacterRepository**
   - Move `assignCharacter()` from `ScenarioRepository` to `ScenarioCharacterRepository`
   - Move `unassignCharacter()` from `ScenarioRepository` to `ScenarioCharacterRepository`
   - Move `getAssignedCharacters()` from `ScenarioRepository` to `ScenarioCharacterRepository`
   - Move `isCharacterAssigned()` from `ScenarioRepository` to `ScenarioCharacterRepository`
   - Move `reorderCharacters()` from `ScenarioRepository` to `ScenarioCharacterRepository`

2. **Update ScenarioRepository to delegate character operations**
   - Update `createWithCharacters()` to use `ScenarioCharacterRepository`
   - Update `findByIdWithCharacters()` to use `ScenarioCharacterRepository`
   - Remove duplicate character-related interfaces from `ScenarioRepository`

3. **Consolidate interfaces and types**
   - Move `ScenarioCharacterAssignment` interface to `ScenarioCharacterRepository` (remove duplicate)
   - Move `AssignCharacterOptions` interface to `ScenarioCharacterRepository`
   - Move `CharacterOrder` interface to `ScenarioCharacterRepository`
   - Update exports in index files

### Phase 3: Move JSON Serialization to Repository Layer
**Goal**: Repository handles all database storage details, router works with objects

#### Tasks:
1. **Update repository to handle JSON serialization**
   - Modify `ScenarioRepository.create()` to accept objects and stringify internally
   - Modify `ScenarioRepository.update()` to accept objects and stringify internally
   - Ensure consistent JSON handling across all repository methods

2. **Update router to pass objects directly**
   - Remove manual `JSON.stringify()` calls from router create/update methods
   - Pass `input.settings` and `input.metadata` as objects directly
   - Remove JSON conversion logic from router validation

3. **Update transform functions to handle JSON parsing**
   - Ensure transform functions properly parse JSON strings back to objects
   - Add error handling for malformed JSON in database

### Phase 4: Simplify Transform Functions
**Goal**: Eliminate duplication and work with actual query return types

#### Tasks:
1. **Analyze actual query return types**
   - Document the exact types returned by repository join queries
   - Identify commonalities between transform functions

2. **Consolidate transform functions**
   - Replace `toScenarioCharacterAssignment()` and `transformScenarioCharacterAssignment()` with single function
   - Ensure transforms work with actual Drizzle query result types
   - Remove unnecessary intermediate type conversions

3. **Simplify character assignment transforms**
   - Create single `transformCharacterAssignment()` that works with join query results
   - Update all usages to use consolidated function
   - Remove duplicate character parsing logic

### Phase 5: Standardize Error Handling
**Goal**: Consistent error handling across all repository methods

#### Tasks:
1. **Audit current error handling patterns**
   - Document which methods throw vs return booleans
   - Identify business logic vs technical errors

2. **Standardize error handling approach**
   - **Business rule violations**: Always throw specific errors (e.g., "already assigned")
   - **Not found scenarios**: Always throw specific errors (e.g., "scenario not found")
   - **Success/failure operations**: Return boolean for pure success/failure (e.g., soft delete)

3. **Update method signatures and implementations**
   - Update `unassignCharacter()` to throw error if not found instead of returning false
   - Ensure all character assignment methods throw descriptive errors
   - Update router error handling to catch and convert to appropriate TRPCError codes

### Phase 6: Integration Testing and Cleanup
**Goal**: Ensure refactored system works correctly and clean up unused code

#### Tasks:
1. **Update test scripts**
   - Update `test-scenario-repo.ts` to use new repository structure
   - Test character assignment operations through new interface
   - Verify JSON serialization/deserialization works correctly

2. **Update router integration**
   - Test all tRPC endpoints with refactored repositories
   - Verify error handling propagates correctly
   - Test character assignment operations end-to-end

3. **Clean up exports and imports**
   - Remove unused exports from index files
   - Clean up imports in router files
   - Remove any dead code from refactoring

4. **Documentation updates**
   - Update CLAUDE.md with new repository patterns
   - Document the simplified architecture
   - Update code examples to reflect new patterns

## Expected Benefits

1. **Reduced Code Duplication**: Elimination of redundant validation and repository logic
2. **Improved Separation of Concerns**: Router focuses on API logic, repository handles data persistence
3. **Better Type Safety**: Transform functions work with actual query types
4. **Consistent Error Handling**: Predictable error patterns across the API
5. **Simplified Maintenance**: Fewer files and clearer responsibility boundaries

## Implementation Order

Execute phases in order as each phase builds on the previous one. Within each phase, complete all tasks before moving to the next phase.

## Quality Gates

- All existing tests must pass after each phase
- TypeScript compilation must succeed with no errors
- Linting rules must pass
- API behavior must remain consistent (no breaking changes to tRPC interface)
- Repository method signatures should be simplified, not made more complex

## Notes

- This refactoring maintains the same public API surface (tRPC endpoints)
- Database schema remains unchanged
- The record reuse pattern for soft deletes is preserved
- All business logic behavior is maintained, only implementation is improved

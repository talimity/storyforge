# Character Data Fetching Implementation Plan

## Overview

Implement data fetching for the Character library using modern tRPC + React Query patterns. This will replace placeholder UI with real server data and enable character imports via file upload to the existing REST endpoint.

## Research Summary

**tRPC Modern Pattern**: Use `@trpc/react-query` integration with TanStack Query for server state management. This eliminates manual state management (useState, Zustand) for server data.

**Available Character API**:
- tRPC endpoint: `characters.list()` returns `{ characters: Character[] }`
- REST upload endpoint: `POST /api/characters/import` accepts PNG files with embedded character data
- Image serving: `GET /api/characters/{id}/image` returns character images
- Full TypeScript support with automatic cache invalidation

**File Upload Strategy**: Since tRPC doesn't support multipart uploads, use the existing REST endpoint `/api/characters/import` for file uploads, then invalidate tRPC queries to refresh the character list.

## Tasks

### 1. Set up tRPC client with React Query integration
- Install required dependencies (@trpc/react-query, @tanstack/react-query)
- Create tRPC client configuration in `src/lib/trpc.ts`
- Set up providers in main.tsx with proper error handling
- Configure API base URL (backend runs on :3001)

### 2. Implement character list component with data fetching
- Replace placeholder character list in `src/pages/characters.tsx` with real data fetching
- Use `trpc.characters.list.useQuery()` hook for server state management
- Add loading states, error handling, and empty states
- Display character cards with images (`/api/characters/{id}/image`), names, and descriptions
- Implement responsive grid layout for character cards

### 3. Create character import modal with file upload
- Create modal component using Chakra UI v3 Dialog in `src/components/character-import-modal.tsx`
- Add file input with PNG validation and drag-and-drop UX
- Show file preview and import progress
- Add upload progress and success/error feedback with toasts

### 4. Implement multipart file upload to REST endpoint
- Create utility function for uploading to `/api/characters/import` in `src/lib/api.ts`
- Handle FormData construction and multipart upload with progress tracking
- Process upload response and extract character data
- Add proper error handling for different upload failure scenarios (404, 406, 500)

### 5. Set up cache invalidation after character import
- Use `trpc.useUtils()` to access cache invalidation methods
- Invalidate `characters.list` query after successful upload
- Ensure character list reflects new imports immediately
- Consider optimistic updates for better UX if needed

### 6. Add proper error handling and loading states
- Implement loading spinners and skeleton states for character cards
- Add toast notifications for success/error feedback using Chakra UI toast
- Handle network errors, file validation errors, and server errors
- Provide user-friendly error messages with actionable suggestions

### 7. Test complete character import and list refresh flow
- Test with valid TavernCard PNG files from backend data directory
- Verify immediate list refresh after import without manual refresh
- Test error scenarios (invalid files, network issues, server errors)
- Verify responsive behavior and accessibility compliance

## Implementation Notes

- **No manual state management**: Let tRPC and React Query handle all server state automatically
- **Type safety**: Leverage full TypeScript integration with API contracts from `packages/api`
- **Modern patterns**: Use latest React Query patterns with query options and cache invalidation
- **User experience**: Focus on immediate feedback and smooth transitions
- **Error resilience**: Handle all error cases gracefully with clear user messaging

## Success Criteria

- Character list loads from server on page load
- Import modal accepts PNG files and uploads to server
- Character list automatically refreshes after successful import
- All loading states and error scenarios handled properly
- No manual state management required for server data
- Full TypeScript safety maintained throughout
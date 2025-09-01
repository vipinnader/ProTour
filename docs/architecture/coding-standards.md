# Coding Standards

MINIMAL but CRITICAL standards for AI agents focused on project-specific rules that prevent common mistakes in ProTour's fullstack tournament management system.

## Critical Fullstack Rules

- **Type Sharing:** Always define types in `libs/shared-types` and import from there. Never duplicate type definitions across frontend and backend
- **API Calls:** Never make direct HTTP calls - always use the service layer (`TournamentService`, `MatchService`, etc.) which handles offline/online transitions
- **Environment Variables:** Access only through config objects (`Config.firebase.apiKey`), never `process.env` directly in client code
- **Error Handling:** All API routes must use the standard error handler middleware with request ID tracking for debugging
- **State Updates:** Never mutate state directly - use proper state management patterns (Zustand actions, Firestore transactions)
- **Offline Operations:** All tournament operations must work offline-first. Always check sync status before assuming data consistency
- **Authentication Flow:** Always validate user roles before tournament operations. Use `requireTournamentAccess()` middleware for protected routes
- **Real-time Subscriptions:** Always cleanup Firestore listeners in component unmount to prevent memory leaks
- **File Uploads:** All file operations must use Firebase Storage with proper security rules. Never store files in public directories

## Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `TournamentDashboard.tsx` |
| Hooks | camelCase with 'use' | - | `useTournamentSync.ts` |
| Services | PascalCase + Service | PascalCase + Service | `TournamentService.ts` |
| API Routes | - | kebab-case | `/api/tournament-brackets` |
| Database Collections | - | camelCase | `tournaments`, `delegationTokens` |
| Firebase Functions | - | camelCase | `updateMatchScore`, `sendNotification` |
| Store Actions | camelCase | - | `setActiveTournament`, `updateMatchScore` |
| Constants | SCREAMING_SNAKE_CASE | SCREAMING_SNAKE_CASE | `MAX_TOURNAMENT_PLAYERS` |

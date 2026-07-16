# Debug Session: project-profile-404

Status: [OPEN]

## Symptom

- `GET /projects/:projectId/profile` returns `404 Route not found`
- Other Fastify routes continue to work

## Scope

- Investigate route registration only
- No architecture changes
- No API changes
- No unrelated feature work

## Initial Hypotheses

1. `src/api/routes/project-profile.ts` exists but is not actually imported or registered from `src/api/routes/index.ts`.
2. The source code is correct, but the running build in `dist/` is stale and does not contain the new route module or route import.
3. The route plugin is imported, but an exception during app/container setup prevents that plugin from registering while allowing the rest of Fastify to start.
4. The app is starting from a different entrypoint or duplicate route index file than expected, so `projectProfileRoutes` is never reached at runtime.
5. PM2 or the production process is serving an older compiled artifact, so only previously existing routes are available.

## Required Evidence

- Source imports/registrations
- Built `dist/` route files
- Runtime `app.printRoutes()`
- Runtime container shape
- Actual server entrypoint/build path in use


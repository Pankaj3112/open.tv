# Rename Project to open.tv

## Overview

Rename the project from various legacy names (`feature-mvp`, `iptv`) to the unified brand `open.tv` / `opentv`.

## Naming Convention

| Context | Name |
|---------|------|
| Brand/Display | open.tv |
| Package name | opentv |
| Cloudflare Pages | opentv |
| D1 Database | opentv-db |
| GitHub repo | Pankaj3112/open.tv |
| Directory | open-tv |

## Changes

### Codebase Files

| File | Field | From | To |
|------|-------|------|-----|
| package.json | name | feature-mvp | opentv |
| wrangler.toml | name | iptv | opentv |
| wrangler.toml | database_name | iptv-db | opentv-db |
| wrangler.toml | database_id | (old ID) | (new ID after DB creation) |
| src/app/layout.tsx | title | IPTV Browser | open.tv |
| src/components/header.tsx | GitHub URL | Pankaj3112/iptv | Pankaj3112/open.tv |
| src/hooks/use-favorites.ts | STORAGE_KEY | iptv-favorites | opentv-favorites |
| src/hooks/use-history.ts | STORAGE_KEY | iptv-history | opentv-history |
| CLAUDE.md | various | iptv-db references | opentv-db |
| README.md | all | boilerplate | project-specific |

### Cloudflare Infrastructure

1. Create new D1 database:
   ```bash
   npx wrangler d1 create opentv-db
   ```

2. Update wrangler.toml with new database_id from output

3. Apply schema:
   ```bash
   npx wrangler d1 execute opentv-db --file=schema.sql
   ```

4. Run sync script to populate data

5. Deploy to Cloudflare Pages:
   ```bash
   npm run pages:deploy
   ```
   This creates new project at opentv.pages.dev

### Cleanup (Optional)

- Delete old `iptv-db` database via Cloudflare dashboard
- Delete old Pages project if exists

## Notes

- localStorage keys changing will reset users' favorites and watch history
- docs/plans/ files left unchanged (historical records)

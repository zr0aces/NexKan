# Versioning & Releases

NexKan uses Calendar Versioning (**CalVer**) with the scheme `YYYY.M.PATCH`.

---

## Versioning Scheme

- `YYYY` — Year (4 digits, e.g. `2026`)
- `M` — Month (1-12, e.g. `6`)
- `PATCH` — Minor patch/fix incrementer, which resets to `1` when the calendar month or year transitions.

### Examples of version increments:
- Within the same month: `2026.6.2` → `2026.6.3` → `2026.6.4`
- Month transition: `2026.5.4` → `2026.6.1`

---

## Storing and Syncing Versions

The **single source of truth** for the version is the root `package.json` file.

To sync version metadata across all workspace components, use [sync-version.js](file:///home/san/workspace/NexKan/scripts/sync-version.js):

```bash
node scripts/sync-version.js [VERSION]
```

### What this script does:
1. Sets the version in the root `package.json`.
2. Propagates the version to all monorepo workspaces:
   - `backend/package.json`
   - `frontend/package.json`
   - `shared/package.json`
3. Updates the `package-lock.json` lockfile.
4. Writes the version dynamically to a shared TypeScript module ([version.ts](file:///home/san/workspace/NexKan/shared/src/lib/version.ts)), which is imported by both the frontend and backend.
5. Automatically recompiles the shared workspace (`@nexkan/shared`) so dependent workspaces receive the updated modules instantly.

*Note: If no `[VERSION]` argument is provided, `sync-version.js` auto-calculates the next version based on today's calendar date and the current package version.*

---

## Preparing a Release

To prepare a new release, run [release.js](file:///home/san/workspace/NexKan/scripts/release.js):

```bash
node scripts/release.js [VERSION]
```

### What this script does:
1. Invokes `sync-version.js` to update and build all package versions.
2. Detects the current active Git branch (using `git branch --show-current`).
3. Prints the exact, branch-aware Git commands to stage, commit, tag, and push the release safely without triggering syntax errors in Bash.

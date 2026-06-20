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

The **single source of truth** for the version is the root [VERSION](file:///home/san/workspace/NexKan/VERSION) file.

To sync version metadata across all workspace components, use [sync-version.mjs](file:///home/san/workspace/NexKan/scripts/sync-version.mjs):

```bash
node scripts/sync-version.mjs [--check]
```

### What this script does:
1. Reads the version from the root `VERSION` file.
2. Propagates the version to all monorepo workspaces:
   - root `package.json`
   - `backend/package.json`
   - `frontend/package.json`
   - `shared/package.json`
3. Updates the `package-lock.json` lockfile.
4. Writes the version dynamically to a shared TypeScript module ([version.ts](file:///home/san/workspace/NexKan/shared/src/lib/version.ts)), which is imported by both the frontend and backend.
5. Automatically recompiles the shared workspace (`@nexkan/shared`) so dependent workspaces receive the updated modules instantly.

*Note: You can pass `--check` to verify that all package files are currently in sync with the `VERSION` file (used as a CI gate).*

---

## Preparing a Release

To prepare a new release, run [release.mjs](file:///home/san/workspace/NexKan/scripts/release.mjs):

```bash
node scripts/release.mjs [VERSION] [--tag] [--build]
```

### What this script does:
1. Auto-calculates the next version based on today's calendar date (bumping patch/minor, resetting to `1` on month change) or validates the provided `[VERSION]` argument.
2. Updates the root `VERSION` file.
3. Invokes `sync-version.mjs` to update and build all package versions.
4. Optionally builds version-tagged Docker compose images (`--build`).
5. Optionally stages, commits, and tags the release in Git (`--tag`).
6. Detects the current active Git branch and prints the exact commands to push the release safely.

# Cleanup Plan: Unused Code, Legacy Test Scaffolding & Documentation Alignment

**Date:** 2026-10-04  
**Status:** Complete

---

## Scope & User Choices

1. **`docs/superpowers/` Reorganization (Option A)**:
   - Move 6 completed plans to `docs/plans/completed/`.
   - Move 4 specs to `docs/specs/`.
   - Remove obsolete `docs/superpowers/` directory.
2. **`frontend/public/` Assets**:
   - Keep all 17 logo files in `frontend/public/` per user request.
3. **Root & Frontend Dead Files**:
   - Remove orphan `test.ico`.
   - Remove empty `frontend/src/types/` directory.
   - Remove unreferenced barrel `frontend/src/components/dashboard/index.ts`.
4. **Frontend Dependencies & Code Cleanup**:
   - Uninstall `@radix-ui/react-select`.
   - Remove dead import `useCallback` in `KanbanBoard.tsx`.
   - Remove dead import `Input` in `ConvertDialog.tsx`.
   - Remove unused `isOpen` prop in `ScratchpadPanel.tsx` and parent callers.
5. **Backend Code & Test Scaffolding**:
   - Prefix unused parameters with `_` (`_eventType`) in `scratchpad/store.ts`, `storage/fileSystem.ts`, `tasks/store.ts`.
   - Clean up `SERVER_MODE` / `isFastify` scaffolding in `tests/contract/server.ts`.
   - Remove dead Express `else` branches in `tests/contract/differences.contract.test.ts`.
6. **Documentation & Scripts**:
   - Remove dead `src/types/task.ts` entry in `docs/ai-agent-guidelines.md`.
   - Make path dynamic in `scripts/generate_logo.py`.
7. **Verification & Graphify**:
   - Run tests and builds across all packages.
   - Run `graphify update .`.
   - Archive plan to `docs/plans/completed/`.

---

## Tasks

- [x] Delete `test.ico`, `frontend/src/components/dashboard/index.ts`, and empty directory `frontend/src/types/`
- [x] Uninstall `@radix-ui/react-select` from `frontend`
- [x] Clean up frontend unused imports (`KanbanBoard.tsx`, `ConvertDialog.tsx`) and `isOpen` prop (`ScratchpadPanel.tsx`, `BoardPage.tsx`, `DashboardPage.tsx`)
- [x] Prefix `_eventType` in backend stores and storage watcher
- [x] Clean up contract test Express scaffolding in `backend/tests/contract/server.ts` and `differences.contract.test.ts`
- [x] Move `docs/superpowers/plans/*` to `docs/plans/completed/`
- [x] Move `docs/superpowers/specs/*` to `docs/specs/` and delete `docs/superpowers/`
- [x] Update `docs/ai-agent-guidelines.md` and `scripts/generate_logo.py`
- [x] Run full test suite and builds
- [x] Update Graphify and archive plan

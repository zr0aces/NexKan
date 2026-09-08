# GEMINI.md

Guidance for Google Antigravity CLI (`agy`) in this repository.

Project overview, monorepo structure, commands, architecture, key invariants, and shared AI workflow conventions (Graphify, RTK, Caveman) live in [`docs/ai-agent-guidelines.md`](docs/ai-agent-guidelines.md) — read that first. This file adds only what's specific to Antigravity.

## Antigravity Specific

- Global hooks in `~/.gemini/settings.json` wire RTK (`BeforeTool` on `run_command`/`run_shell_command`) and the Graphify read guard. Both apply automatically; do not re-prefix commands that the hook already rewrote.

<!-- agent-parity:pointer -->
## Shared memory and agent state

This repository is wired with `agent-parity`: a shared `memory` MCP server (`memory_recent`, `memory_add`, `memory_search`, `memory_get`) plus managed files under `.agent-parity/`, `.mcp.json`, `.cursor/`, `.codex/`, and `.agents/`. Treat those as repository state, not disposable generated files, and commit every changed managed file when you push.

The full rules — including the cross-agent bootstrap for repairing a missing `memory` registration — live in the `agent-parity` block in [`AGENTS.md`](./AGENTS.md). Read it before touching memory wiring or bypassing the pre-push guard.
<!-- /agent-parity:pointer -->

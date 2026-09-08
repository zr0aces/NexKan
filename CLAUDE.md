# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

Project overview, monorepo structure, commands, architecture, key invariants, and shared AI workflow conventions (Graphify, RTK, Caveman) live in [`docs/ai-agent-guidelines.md`](docs/ai-agent-guidelines.md) — read that first. This file adds only what's specific to Claude Code.

## Claude Code Specific

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

<!-- agent-parity:pointer -->
## Shared memory and agent state

This repository is wired with `agent-parity`: a shared `memory` MCP server (`memory_recent`, `memory_add`, `memory_search`, `memory_get`) plus managed files under `.agent-parity/`, `.mcp.json`, `.cursor/`, `.codex/`, and `.agents/`. Treat those as repository state, not disposable generated files, and commit every changed managed file when you push.

The full rules — including the cross-agent bootstrap for repairing a missing `memory` registration — live in the `agent-parity` block in [`AGENTS.md`](./AGENTS.md). Read it before touching memory wiring or bypassing the pre-push guard.
<!-- /agent-parity:pointer -->

# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository.

Project overview, monorepo structure, commands, architecture, key invariants, and shared AI workflow conventions (Graphify, RTK, Caveman) live in [`docs/ai-agent-guidelines.md`](docs/ai-agent-guidelines.md) — read that first. This file adds only what's specific to Claude Code.

## Claude Code Specific

### Claude-Mem (Cross-Session Memory)

This project uses `claude-mem` for persistent memory across Claude Code sessions.

- **Context injection**: review the `<claude-mem-context>` block injected at session start for active observations.
- **Memory queries**: when asked about previous sessions or fixes, use the `search` and `timeline` MCP tools.
- **3-layer workflow**:
  1. **Search** — `search(query="...", project="...")` returns a compact list of IDs.
  2. **Timeline** — `timeline(anchor=ID, project="...")` inspects context around specific events.
  3. **Fetch** — `get_observations(ids=[...])` retrieves detailed observations only for target IDs.

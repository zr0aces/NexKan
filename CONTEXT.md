# Domain & Architecture Context

This document outlines the core domain model terms and architectural concepts for NexKan.

## Domain Glossary

* **Task** — A personal Kanban unit stored as a markdown file with YAML frontmatter. Enforces the invariant that `todo` and `in-progress` tasks require a due date.
* **Note (Scratchpad)** — A lightweight text card stored in the scratchpad. Can be converted to a Task (using its first line as the title and remaining text as the description).
* **Column** — Status columns (`todo`, `in-progress`, `done`) which tasks belong to. Sorting order is relative to each column.

## Architectural Seams & Adapters

* **StorageProvider** (Seam) — A relative, path-based filesystem abstraction interface. Isolates raw directory reads/writes, path handling, exists checks, and file watchers from domain logic.
* **FileSystemStorageProvider** (Adapter) — Production implementation of `StorageProvider` that interacts directly with the local disk utilizing `fs.promises` and directory watchers.
* **InMemoryStorageProvider** (Adapter) — A lightweight in-memory test double of `StorageProvider` used to verify store and router behavior without touching the disk.

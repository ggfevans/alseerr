# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alfred workflow for searching and requesting media via a personal Seerr instance. Written in JXA (JavaScript for Automation). Seerr provides a unified API over Sonarr (TV) and Radarr (Movies).

## Development Workflow

### Git Worktrees Required

All feature work MUST use git worktrees for isolation:

```bash
# Create worktree for issue work
git worktree add .worktree/Alseerr-issue-<N> -b <type>/<N>-<description>

# Examples:
git worktree add .worktree/Alseerr-issue-1 -b feat/1-poster-caching
git worktree add .worktree/Alseerr-issue-2 -b fix/2-request-error
```

Branch naming: `<type>/<issue-number>-<short-description>`
- Types: `feat/`, `fix/`, `chore/`, `docs/`

### PR Required for All Changes

- No direct commits to `main`
- All changes via Pull Request
- PRs should reference the issue number

### Syncing with Alfred

The workflow lives in two places:
1. This git repo (source of truth)
2. Alfred's preferences folder (where it runs)

Use `just` commands to sync:
```bash
just transfer-changes-TO-local    # Push git changes to Alfred
just transfer-changes-FROM-local  # Pull Alfred changes to git
just open-local-workflow-in-alfred  # Open in Alfred for visual editing
just show-workflow-path             # Show Alfred workflow location
```

Requires `.env` file with `WORKFLOW_UID` (copy from `.env.example`).

## Code Architecture

### JXA Constraints

JXA (JavaScript for Automation) runs in JavaScriptCore with ObjC bridge:
- No `require()` or ES modules; each script is self-contained
- No `fetch()`; use `curl` via `app.doShellScript()`
- No `URL` constructor; use regex parsing
- Global `$` and `ObjC` objects for macOS APIs
- Entry point is `run(argv)` function
- `doShellScript()` converts `\n` to `\r`; use text markers (e.g. `__HTTPSTATUS__`) instead of newline-based parsing

### Scripts

```
scripts/
├── search.js    # Script Filter: searches Seerr, returns Alfred JSON
└── request.js   # Run Script: submits request to Seerr, shows notification
```

Because JXA scripts can't use `require()`, pure utility functions (`shellEscape`, `truncate`, `alfredMatcher`, `extractYear`, `getMediaStatus`) are duplicated between `search.js` and `request.js`. Tests in `tests/utils.test.js` re-implement these same functions. All three copies must stay in sync.

### Workflow Variables (configured in Alfred UI)

| Variable | Description | Example |
|----------|-------------|---------|
| `seerr_url` | Seerr instance URL | `https://seerr.falcon-wahoo.ts.net` |
| `seerr_api_key` | Seerr API key | `MTc2NDY2...` |
| `timeout_ms` | Request timeout | `5000` |

### Alfred Workflow Structure

```
Keyword "alseerr"
  → Script Filter (scripts/search.js)
    → Default action: Open URL (opens item in Seerr web UI)
    → Alt action: Run Script (scripts/request.js, submits request + opens Seerr)
```

## Testing

Node.js built-in test runner (`node:test`), no external dependencies.

```bash
npm test                          # Run all tests
node --test tests/utils.test.js   # Run a single test file
```

### What to Test

- **DO test:** Pure functions (`shellEscape`, `truncate`, `alfredMatcher`, `extractYear`, `getMediaStatus`)
- **DO test:** Alfred JSON output structure
- **DO test:** Error handling paths
- **DON'T test:** JXA-specific code (requires macOS runtime, `ObjC` bridge, `app.doShellScript`)

## Security Considerations

### Shell Injection Prevention

When calling shell commands via `app.doShellScript()`:
1. Always use `shellEscape()` for user-controlled values
2. Use `--` separator before URLs/paths to prevent option injection
3. Prefer single quotes over double quotes for escaping

### API Key Handling

- API key is stored in Alfred workflow variables (encrypted at rest by Alfred)
- Passed via `X-Api-Key` header through a curl config temp file (`curl -K`), never in URL parameters or process arguments

## Seerr API Reference

- Base path: `/api/v1`
- Auth: `X-Api-Key` header
- Search: `GET /search?query=...&language=en`
- Request: `POST /request` with `{ mediaType, mediaId }`
- Media status: 1=Unknown, 2=Pending, 3=Processing, 4=Partial, 5=Available
- API docs: https://api-docs.overseerr.dev/

## Version Management

This project uses **CalVer** (calendar versioning) in `YYYY.MM.DD` format (e.g. `2026.02.24`). Version lives in both `package.json` and `info.plist`.

## Release Process

1. Run `just release` (prompts for version, updates both plists, commits, tags with `v` prefix, pushes)
2. GitHub Actions triggers on `v*` tags and builds the `.alfredworkflow` bundle

## References

- [Seerr API](https://api-docs.overseerr.dev/)
- [Alfred Script Filter JSON](https://www.alfredapp.com/help/workflows/inputs/script-filter/json/)
- [JXA Cookbook](https://github.com/JXA-Cookbook/JXA-Cookbook)
- Seek workflow (SearXNG-Seek-Alfred): sibling project, same patterns

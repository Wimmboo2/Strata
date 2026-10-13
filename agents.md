# AGENTS.md: rules for working on Strata

Read `idea.md` before making changes. It is the source of truth for what Strata is and does.

## Hard rules

1. Never install packages, dependencies, SDKs, CLIs, browser extensions, or system software without asking the user first and receiving explicit approval.
2. If requirements are unclear, ask questions. Do not guess.
3. If documentation or behavior is uncertain, check official documentation or reputable sources. Do not invent answers.
4. Verify code by reading and reasoning. Do not run code, start localhost, build, test, or execute commands unless the user explicitly asks.
5. Before large or destructive changes (many files, deletions, refactors, config changes), explain the plan and wait for approval.
6. Modify only what is necessary. Do not rewrite working code unless the user asks for a refactor.
7. Never access, modify, or delete files outside this project folder unless the user explicitly asks.
8. After every completed task, list exactly what changed: files created, files edited, and what was changed in each.

## Strata-specific rules

- Only read public GitHub repositories. Never add code that requests, stores, or uses a token capable of reading private repos.
- GitHub access is read-only. Never write to GitHub.
- Never commit secrets. API keys, Supabase keys, and GitHub App private keys go in environment variables, never in source.
- Use Supabase Row Level Security on every table that holds user data.
- Status values are fixed to `building`, `finished`, `paused`. Do not add new statuses without approval.
- Keep the frontend on Vercel and the backend (webhooks, sync job) on Render. Do not move services without approval.
- Use TypeScript for all new code.
- No emojis in code, UI copy, commit messages, or docs.
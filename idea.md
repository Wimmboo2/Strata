# Strata

A public website where people track their projects. Each project has a status, labels, and a live activity feed (commits, pull requests, issues) pulled from the project's public GitHub repos.

## Users

- Anyone can register. Login is required to create or edit projects. Browsing may be public or login-only (see open questions).
- Registration asks for an email and password (Supabase Auth) and a link to the user's GitHub profile. The link is saved on the profile.
- Users can have many projects.

## Data sources and privacy

- Only public repositories. Strata never reads private repos and never asks for a token that can.
- GitHub is read-only from Strata's side. Strata never writes to a repo.
- Commits, PRs, and issues are copied into Supabase so pages load fast and history is kept even if a repo changes.

## Statuses

Fixed set: `building`, `finished`, `paused`. Each project has exactly one.

## Labels

Freeform tags attached to a project (for example `frontend`, `side-project`, `ai`). Used for filtering and grouping.

## Refresh

Two layers:

1. **Webhooks (near-instant).** GitHub only lets a repo owner set up webhooks, so a user has to install a Strata GitHub App and select their public repos. Pushes, PR events, and issue events then arrive within seconds.
2. **Scheduled sync (fallback).** A Render cron job polls linked repos on an interval, using conditional requests (ETags) so polling stays cheap and inside GitHub's rate limits. This covers repos where the app isn't installed.

Known limit: for a repo the user does not own and has not installed the app on, updates can lag by up to the poll interval. "Every update, instantly" is only possible for repos where the app is installed.

## Features (v1)

- Register with email and GitHub profile link
- Create a project, set its status, add labels
- Link a project to one or more public repos
- Project page: status, labels, description, activity feed (commits, PRs, issues)
- Project list with filters by status and label
- Refresh via webhook (where installed) and scheduled sync (everywhere else)

## Non-goals (v1)

- Private repos of any kind
- Organization dashboards
- Mobile app
- Writing anything back to GitHub

## Stack

- **Frontend:** Next.js with TypeScript, deployed on Vercel
- **Backend:** Node.js with TypeScript on Render. Handles the webhook endpoint and the sync job.
- **Database and auth:** Supabase (Postgres, Auth, Row Level Security)
- **GitHub integration:** GitHub REST API, plus a GitHub App for webhooks

## Rough data model

- `profiles`: user id, display name, GitHub profile URL, GitHub username
- `projects`: id, owner id, name, description, status, created and updated times
- `labels`: id, project id, name
- `project_repos`: project id, GitHub repo full name, installation id (nullable)
- `commits`, `pull_requests`, `issues`: repo id, GitHub id, title or message, author, URL, timestamps
- `github_installations`: installation id, GitHub account login, owner profile id
- `sync_state`: repo id, last ETag, last synced at

## Open questions

1. **GitHub link verification.** Trust the pasted link as is, or require "sign in with GitHub" so the username is verified?
2. **Visibility.** Can anyone see any project (public), or only logged-in users?
3. **Label rules.** Can any user create labels that show up globally, or are labels only scoped to their own projects?
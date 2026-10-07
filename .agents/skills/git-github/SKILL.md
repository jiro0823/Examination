---
name: git-github
description: Safely manage Git branches, worktrees, staging, commits, pushes, GitHub repository operations, and pull requests while preserving unrelated user work.
---

# Purpose

Own Git and GitHub operations while protecting repository history,
validation status, secrets, and unrelated user work.

Application implementation belongs to Implementer.

Independent verification belongs to QA.

# Use When

Use for:

- Git status inspection
- diff inspection
- branch creation
- branch switching
- branch verification
- worktrees when genuinely useful
- staging
- commits
- pushes
- remote verification
- GitHub repository operations
- pull request preparation
- pull request creation
- relevant Git history inspection

# Preconditions

Before any Git write operation:

1. inspect Git status
2. identify current branch
3. inspect intended diff
4. identify unrelated user changes
5. preserve unrelated work
6. determine validation status
7. check for obvious secrets
8. confirm the requested Git operation

Never assume every modified file belongs to the requested task.

# Branch Workflow

Follow existing repository branch conventions when available.

If none exist, prefer:

- feat/<description>
- fix/<description>
- refactor/<description>
- test/<description>
- docs/<description>
- chore/<description>

Do not create unnecessary branches.

Do not switch branches if doing so puts unrelated working-tree changes at
risk.

# Commit Workflow

Before committing:

1. inspect status
2. inspect intended diff
3. identify intended files
4. exclude unrelated user changes
5. know validation status
6. check for obvious secrets
7. stage only intended files

Follow existing commit conventions.

If none exist, prefer Conventional Commit prefixes:

- feat:
- fix:
- refactor:
- test:
- docs:
- chore:
- build:
- ci:

Keep commits focused.

Do not claim validation passed if it did not run.

# Push Workflow

Before pushing:

1. verify current branch
2. verify intended remote
3. verify destination branch
4. verify requested operation
5. know validation status

Never force push without explicit authorization.

# Pull Request Workflow

Before preparing or creating a pull request:

1. verify source branch
2. verify intended base branch
3. inspect relevant commits
4. inspect complete diff
5. know validation status
6. prepare a concise title
7. summarize the actual changes
8. report testing truthfully
9. identify known risks
10. reference verified issues when relevant

Never fabricate test results.

Never automatically merge a pull request.

# Worktree Workflow

Use Git worktrees only when genuinely independent writable work benefits
from isolation.

Do not create worktrees for ordinary sequential development.

Do not create worktrees merely because multiple roles exist.

Concurrent writable workers must have non-overlapping ownership.

Before removing a temporary worktree, verify its work is safely
preserved.

# Secret Protection

Before staging or committing, watch for:

- .env files
- credentials
- API keys
- tokens
- private keys
- service-account files
- generated secret/configuration files

Do not stage sensitive material merely because it appears in Git status.

# Safety

Never perform without explicit authorization:

- force push
- reset --hard
- destructive git clean
- shared-history rewriting
- remote branch deletion
- branch-protection bypass
- pull-request merge

Do not modify application code merely to make a Git operation succeed.

Preserve unrelated user changes.

# Expected Output

## Repository State

## Branch

## Changes Included

## Validation Status

## Git/GitHub Action

## Result

## Remaining Actions

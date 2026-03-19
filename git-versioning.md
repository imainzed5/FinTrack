# git-versioning.md
# Moneda — Git Branching & Versioning Reference

This file defines the branching strategy, versioning rules, and daily workflow for the Moneda project. All agents and contributors must follow these conventions.

---

## Branch Structure

```
main   ← stable, always live on Vercel production
dev    ← active development, all work happens here
```

- **Never commit directly to `main`**
- All work goes to `dev` first
- `main` is only updated via a deliberate merge from `dev`
- Vercel auto-deploys to production when `main` is updated

---

## Daily Workflow

### Starting work
```bash
git checkout dev
```
Always confirm you're on `dev` before making any changes.

### Committing changes
```bash
git add .
git commit -m "feat: description of what you did"
git push origin dev
```

### Releasing to production (merging dev → main)
```bash
git checkout main
git merge dev --no-ff -m "release: v0.x.x — description of changes"
git tag -a v0.x.x -m "Moneda v0.x.x — description of changes"
git push origin main
git push origin v0.x.x
git checkout dev
```

---

## Commit Message Prefixes

| Prefix | When to use |
|---|---|
| `feat:` | New feature added |
| `fix:` | Bug fix |
| `chore:` | Non-feature work — cleanup, config, dependency updates |
| `wip:` | Work in progress, not finished yet — only push to `dev` |
| `release:` | Merge commit from `dev` → `main` |

### Examples
```
feat: add berde state merge system
fix: greeting truncation on mobile
chore: apply warm background across all pages
wip: statistics panel animation — exit not working yet
release: v0.7.1 — berde state merge, animation polish
```

---

## Versioning Rules

Moneda follows semantic versioning: `MAJOR.MINOR.PATCH`

| Segment | When to bump |
|---|---|
| `PATCH` (0.7.**x**) | Small fixes, polish, copy changes |
| `MINOR` (0.**x**.0) | New feature batch merged to main |
| `MAJOR` (**x**.0.0) | Public launch or breaking redesign |

### Current version: v0.7.1

---

## Version Roadmap

```
v0.7.0  ✓ Homepage redesign, Statistics panel, Berde drawer system
v0.7.1  ✓ Salda floating island mascot, observer tuning, animation polish
v0.7.2  — Small fixes after Salda release
v0.8.0  — Next significant feature batch
v0.9.0  — Pre-launch polish, performance, testing
v1.0.0  — Public launch
```

---

## Tagging a Release

```bash
git tag -a v0.x.x -m "Moneda v0.x.x — description"
git push origin v0.x.x
```

### View all tags
```bash
git tag
```

### View tag details
```bash
git show v0.7.0
```

---

## Vercel Deployment

- **Production branch:** `main`
- **Preview deployments:** `dev` (separate preview URL on every push, does not affect production)
- Vercel auto-deploys to production only when `main` is updated via a merge

---

## Quick Reference Card

```bash
# Start working
git checkout dev

# Save progress
git add .
git commit -m "feat: what you did"
git push origin dev

# Release to production
git checkout main
git merge dev --no-ff -m "release: v0.x.x — description"
git tag -a v0.x.x -m "Moneda v0.x.x — description"
git push origin main
git push origin v0.x.x
git checkout dev
```

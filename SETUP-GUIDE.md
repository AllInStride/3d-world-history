# 3D World History - Setup Guide

## Current Status: DEPLOYED

**Live URL:** https://3d-world-history.vercel.app/

---

## Completed Setup

### Infrastructure
- [x] Forked repo to https://github.com/AllInStride/3d-world-history
- [x] Cloned locally to `/Users/gabrielguenette/projects/3d-world-history`
- [x] Installed Supabase CLI (`brew install supabase/tap/supabase`)
- [x] Added Supabase MCP server to Claude Code
- [x] Added Mapbox MCP server to Claude Code
- [x] Linked Supabase CLI to project

### Database
- [x] Ran `schema.sql` - Created tables (users, research_tasks, user_rate_limits)
- [x] Ran `triggers.sql` - Set up auth.users → public.users sync
- [x] Ran `policies.sql` - Enabled row-level security

### Deployment
- [x] Created `.env.local` with all environment variables
- [x] Deployed to Vercel
- [x] Fixed Resend API (made optional)
- [x] Fixed maxDuration for Hobby plan (800s → 300s)

---

## Security Reminders

- [ ] Rotate Supabase access token (it was shared in chat): https://supabase.com/dashboard/account/tokens
- [ ] Consider rotating other API keys that were shared

---

## Environment Variables (Vercel)

These should all be set in Vercel:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_APP_MODE` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://3d-world-history.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://rzbzvnkppdjbggunlmcq.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_-Zvh54sFnlRyAu0mhg0vtg_4UpCE05z` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_7TcP3G22CAqir1sMZDfkLg_CiJoj0A2` |
| `DEEPRESEARCH_API_KEY` | `KdHtUHcI9p9oJJWPKm1qj77HYAXsWYn56ZhEb1iN` |
| `VALYU_API_KEY` | `KdHtUHcI9p9oJJWPKm1qj77HYAXsWYn56ZhEb1iN` |
| `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` | `pk.eyJ1IjoiYWxsaW5zdHJpZGUiLCJhIjoiY21pZTNhemVoMDg1dzJscHI5cjZpNXN3byJ9.uIWx7hALwcnyAH4ehHmlIQ` |

---

## MCP Servers Configured

These MCP servers are available in Claude Code for this project:

1. **Supabase** - Database operations
   ```bash
   claude mcp add supabase -- npx -y @supabase/mcp-server@latest
   ```

2. **Mapbox** - Geospatial operations
   ```bash
   claude mcp add --transport http mapbox-mcp-production https://mcp.mapbox.com/mcp
   ```

---

## Quick Reference

| Resource | URL |
|----------|-----|
| Live App | https://3d-world-history.vercel.app |
| GitHub Repo | https://github.com/AllInStride/3d-world-history |
| Supabase Dashboard | https://supabase.com/dashboard/project/rzbzvnkppdjbggunlmcq |
| Vercel Dashboard | https://vercel.com/dashboard |
| Mapbox Console | https://console.mapbox.com |

**Supabase Project ID:** `rzbzvnkppdjbggunlmcq`

---

## Local Development

```bash
cd /Users/gabrielguenette/projects/3d-world-history
npm install
npm run dev
```

---

## Resume Instructions

When starting a new Claude Code session, say:

> "Review SETUP-GUIDE.md for the 3d-world-history project status"

---

## Code Changes Made This Session

1. **Made Resend optional** (`src/app/api/enterprise/inquiry/route.ts`)
   - Enterprise inquiry emails now skip gracefully if `RESEND_API_KEY` not set

2. **Reduced maxDuration** (`src/app/api/chat/route.ts`)
   - Changed from 800s to 300s for Vercel Hobby plan compatibility

---

## Architecture

- **Framework:** Next.js 15 + React 19 + TypeScript
- **Database:** Supabase (PostgreSQL + Auth + RLS)
- **3D Globe:** Mapbox GL JS
- **AI Research:** Valyu DeepResearch API
- **Styling:** Tailwind CSS + Framer Motion
- **Deployment:** Vercel

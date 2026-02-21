# Supabase Free Tier Guardrail

**Read this file before any backend or frontend change that affects Supabase. Follow the checklist items and warnings to avoid hitting Free Plan limits.**

## Purpose

This file is a short checklist and set of warnings to read before making any backend change on the Free plan. Follow it every time you or any automation (e.g., Claude) will modify data, schema, storage, or call backend/edge functions from the frontend.

## Context

- You mainly use Supabase via the REST/GraphQL/Realtime/Storage/Edge Function APIs for read, write, update, delete.
- You have 2 free projects on the Free plan. The limits below apply per project or per organization as noted.
- Always assume backend changes may affect quotas and availability for the Free tier.

## Critical Limits

| Resource                  | Free Tier Limit                                   |
| ------------------------- | ------------------------------------------------- |
| Database size (disk)      | 500 MB per project                                |
| Storage                   | 1 GB total                                        |
| Egress (bandwidth)        | 10 GB total (5 GB cached + 5 GB uncached)         |
| Edge Function invocations | 500,000 per month                                 |
| Realtime messages         | 2,000,000 per month                               |
| Realtime peak connections | 200                                               |
| Auth (MAU)                | 50,000 monthly active users                       |
| Backups                   | None on Free plan — you must export data yourself |

**If you exceed 500 MB the database may enter read-only mode and INSERT/UPDATE/DELETE will fail.**

## Pre-Change Checklist

Before making any schema, data, storage, or function change, run through these items:

### Will this change increase disk usage (rows, indexes, attachments)?

- **Yes** → Estimate added size. If total projected > 400 MB, **STOP** and either:
  - Trim test data, or
  - Move large data to external storage, or
  - Upgrade to Pro.
- Note: Indexes and extensions also consume space.

### Will this change upload large files or increase storage usage?

- **Yes** → Estimate added storage. If total projected > 0.8 GB, **STOP** and offload large assets to an external bucket or CDN.

### Will this change increase egress (public file downloads, frequent asset fetches)?

- **Yes** → Estimate monthly egress. If > 8 GB projected, **STOP** and add caching, CDN, or reduce repeated downloads.

### Will this change increase Edge Function invocations?

- **Yes** → Count expected calls per user action × expected active users. If monthly estimate approaches 500k, **STOP** and:
  - Batch work,
  - Use direct Supabase client calls instead of functions where safe,
  - Add server-side aggregation or debounce.

### Will this change increase realtime message volume or connections?

- **Yes** → Estimate messages/month and peak concurrent connections. If approaching 2M messages or 200 connections, **STOP** and:
  - Reduce message frequency,
  - Combine messages,
  - Use presence sparingly.

### Will this change create many auth events (signups, OTPs, reset emails)?

- **Yes** → Remember OTP default ~360/hour and email endpoints are rate-limited. Use test accounts or mocked flows for load testing; don't spam OTP/email endpoints.

### Will the change modify RLS (Row-Level Security) or auth policies?

- **Yes** → Verify policies behave as intended:
  - Confirm authenticated clients can still read/write the expected rows.
  - Verify you did not accidentally grant PUBLIC write access.
  - Test as a regular user (not service_role).

### Does the change create or modify large indexes, materialized views, or extensions?

- **Yes** → These consume disk and can increase initial write costs. Estimate size before applying.

### Will the change run a script that deletes or migrates data?

- **Yes** → Export a backup first (`pg_dump`). Free plan has no downloadable daily backups — take your own backup.
- Always run destructive changes in a dev branch/project first.

### Are you planning load testing?

- **Yes** → Do not use the Free project for large load testing. Use a staging/pro plan or a local/dev environment. Free projects can be paused for inactivity or throttled for abuse.

## Quick Commands to Check Current Usage

Run from SQL editor or CLI:

```sql
-- Check DB size
SELECT pg_size_pretty(pg_database_size(current_database()));

-- Check total disk (approx)
SELECT pg_size_pretty(sum(pg_database_size(datname))) FROM pg_database;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 20;
```

```sql
-- Reclaim space after deletes
VACUUM (VERBOSE, ANALYZE);

-- For a single table
VACUUM FULL my_table;
```

```bash
# Export a dump (run from your machine)
pg_dump -Fc -f backup.dump
```

## Frontend Best Practices to Avoid Hitting Limits

- **Debounce or batch writes.** Avoid writing on every keystroke.
- **Use pagination and limit selects.** Don't pull entire tables to the client.
- **Use cache/CDN for static assets.** Prefer external storage for large files.
- **Use server-side logic (or batch endpoints)** for heavy operations rather than calling Edge Functions per small action.
- **Avoid subscribing to high-frequency realtime topics** in many clients at once.
- **Use test/mocked auth flows** for automation instead of sending many real OTP/emails.
- **Monitor usage:** check Supabase dashboard usage and logs periodically.

## Warnings

- `"cannot execute INSERT in a read-only transaction"` — disk limit reached; delete data + VACUUM or upgrade.
- **Project paused for inactivity** — restore from dashboard or prevent by periodic safe pings.
- If you see auth rate limit responses (429) during tests, pause and throttle your tests.

## Action Plan When Approaching Limits

1. Identify which resource is near limit (DB, storage, egress, functions).
2. Remove or archive old data, or offload assets to external storage/CDN.
3. Run `VACUUM` to reclaim DB space.
4. Reduce write frequency; batch operations.
5. If you need more headroom for development, upgrade the project to Pro.

## Security Reminders

- **Never store the `service_role` key on the frontend.** Service role bypasses RLS and can modify data unrestrictedly.
- Test client code with an authenticated user, not a privileged key.
- RLS misconfiguration can prevent frontend reads/writes. Always test policies with a normal user.

## Emergency Steps (if writes fail in production/dev)

1. Check DB size in SQL editor.
2. If disk full / read-only:
   ```sql
   SET session characteristics AS transaction read write;
   DELETE FROM ... ; -- large/unneeded rows or drop test tables
   VACUUM;
   SET default_transaction_read_only = 'off';
   ```
3. If you cannot free enough space, upgrade to Pro.
4. If project paused: restore from dashboard.

## One-Line Rules for Quick Scanning

- Keep DB **<< 500 MB**.
- Keep Storage **<< 1 GB**.
- Keep monthly egress **<< 10 GB**.
- Keep Edge invocations **<< 500k/month**.
- Debounce writes, batch where possible, avoid mass auth/email tests.
- Always export a `pg_dump` before destructive changes.

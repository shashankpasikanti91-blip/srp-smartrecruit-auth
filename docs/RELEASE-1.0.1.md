# SmartRecruit Auth — Release 1.0.1

## Changes
- Universal contact order: **Name → Phone → Email** across candidates, tracker CSV, submissions, interviews, offers, internal talent, clients.
- Phone auto-detect + international format (`+60 …`, `+91 …`, …); Excel negative repair; glued email/phone split.
- Name cleaner rejects resume headings (`Professional Summary`), strips score prefixes (`67 Name`).
- Admin repair: `POST /api/admin/repair-contacts` (`dry_run: true` by default).

## Deploy (versioned, keep previous)
```bash
cd /opt/srp-smartrecruit-auth
docker tag srp-smartrecruit-auth:latest srp-smartrecruit-auth:1.0.0-$(date +%Y%m%d)
# after build:
docker tag srp-smartrecruit-auth:latest srp-smartrecruit-auth:1.0.1-$(date +%Y%m%d)
docker compose up -d app
```

## Rollback
```bash
docker tag srp-smartrecruit-auth:1.0.0-YYYYMMDD srp-smartrecruit-auth:latest
cd /opt/srp-smartrecruit-auth && docker compose up -d app
```

## Local verify
```bash
npm run test:contacts
```

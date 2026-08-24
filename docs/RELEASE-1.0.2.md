# SmartRecruit Auth — Release 1.0.2

Local-only until you approve deploy.

## Changes
- **Navy Calm** default appearance (navy `#0B1F3A` + white + soft slate-blue accents)
- **Plus Jakarta Sans** modern typography (Classic toggle: Times + Carlito)
- Settings → **Appearance** (colour + typography, localStorage)
- ESS chrome restyled via tokens only (structure unchanged)
- Duplicate hardening: POST/import use `findDuplicateCandidates` (email/phone/passport/LinkedIn/NRIC/hash); import skips dupes; resume hash on insert
- Agentic AI / Coach **not** modified

## Local verify
```bash
cd nextjs-auth
npm run test:contacts
npm run dev
```
- Settings → Appearance: Navy↔Forest, Modern↔Classic (survives refresh)
- ESS: same modules, calmer colours
- Add candidate with existing email/phone → 409 / modal

## Deploy later (do not run until approved)
Tag previous image, build, tag `1.0.2-YYYYMMDD`, up app.

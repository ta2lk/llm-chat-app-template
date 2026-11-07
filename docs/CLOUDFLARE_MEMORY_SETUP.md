# Cloudflare setup: persistent TA2LK AI memory

The chat route continues to work without D1. The memory API deliberately returns HTTP 503 until its database and Cloudflare Access protection are configured.

## 1. Create the D1 database

From the project root:

```bash
npx wrangler d1 create ta2lk-memory
```

Cloudflare prints a real `database_id`. Copy that value into the D1 binding below. Do not use a placeholder ID.

## 2. Add the D1 binding

Add this block to the top-level of `wrangler.jsonc`, preserving the existing AI and assets bindings:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "ta2lk-memory",
    "database_id": "PASTE_REAL_DATABASE_ID_HERE",
    "migrations_dir": "migrations"
  }
]
```

## 3. Configure Cloudflare Access for the memory API

Create a Cloudflare Access self-hosted application protecting only the memory endpoint on your app hostname, using the path `/api/memory*`. Configure an allow policy for your own identity.

Set these Worker variables in the Cloudflare dashboard (Workers & Pages → your Worker → Settings → Variables):

- `ACCESS_TEAM_DOMAIN`: your team domain, for example `your-team.cloudflareaccess.com` (without `https://`).
- `ACCESS_AUD`: the AUD tag shown in the Access application details.

The Worker verifies the Access JWT signature, issuer, audience, expiry, and subject. The database owner key comes from the verified JWT subject, never from a client-supplied user ID.

## 4. Apply the migration

```bash
npx wrangler d1 migrations apply ta2lk-memory --remote
```

## 5. Deploy only after checking configuration

Run:

```bash
npm install
npm run check
npm test
```

Then deploy through your normal reviewed Cloudflare workflow. Do not deploy until the D1 binding, Access app, variables, and migration are all configured.

## Memory API

All endpoints require a valid Cloudflare Access JWT:

- `GET /api/memory` — list up to 200 saved facts for the authenticated user.
- `POST /api/memory` — save JSON such as `{"fact":"Prefers concise Arabic answers","category":"preferences","confidence":1}`.
- `DELETE /api/memory?id=<memory-id>` — delete one of the authenticated user's facts.

The API never accepts an owner ID from the client. SQL statements use bound parameters. Memory facts are not automatically inferred from every conversation yet; automatic memory extraction and user review are a later stage.

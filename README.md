# Reminder me

A lightweight daily transaction reminder app for personal money tracking.

## What it does

- Add transactions for:
  - **I need to pay** (money I borrowed)
  - **I need to collect** (money I lent)
- Set due dates and optional notes.
- Get automatic reminders for:
  - overdue transactions
  - due today
  - upcoming within 3 days
- Mark transactions as settled.
- See open transactions and complete history.

## Run locally

Open `index.html` in your browser.

## Data modes

The app supports two modes:

1. **Local mode** (default): uses browser `localStorage`.
2. **Supabase mode**: enabled when `config.js` has `supabaseUrl` and `supabaseAnonKey`.

### Configure Supabase mode

1. Copy `config.example.js` to `config.js` (or edit existing `config.js`).
2. Fill values:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
};
```

3. Create this table in Supabase SQL Editor:

```sql
create table if not exists reminder_transactions (
  id uuid primary key,
  person text not null,
  amount numeric not null,
  type text not null check (type in ('i-owe', 'owes-me')),
  due_date date not null,
  notes text,
  status text not null check (status in ('open', 'closed')) default 'open',
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
```

4. Enable RLS and add policies that match your auth model.

> Important: Only use the **anon** key in `config.js`. Never place service-role keys in frontend code.

## Deploy on cPanel hosting

Because this app is static, deployment is simple:

1. Upload project files to `public_html`.
2. Ensure `index.html` is in `public_html/index.html`.
3. Keep `config.js` on server with your Supabase URL + anon key.
4. Visit your domain and verify create/update/delete works.

## Supabase MCP server (Codex)

### Installation

Add the Supabase MCP server to Codex:

```bash
codex mcp add supabase --url https://mcp.supabase.com/mcp?project_ref=rebemzjhmzmlkvlgdjgs
```

Alternatively, add this configuration to `~/.codex/config.toml`:

```toml
[mcp_servers.supabase]
url = "https://mcp.supabase.com/mcp?project_ref=rebemzjhmzmlkvlgdjgs"
```

After adding the server, enable remote MCP client support by adding this to `~/.codex/config.toml`:

```toml
[features]
rmcp_client = true
```

Then authenticate:

```bash
codex mcp login supabase
```

Finally, run `/mcp` inside Codex to verify authentication.

Need help? View Codex docs.

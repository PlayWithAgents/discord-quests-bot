# Discord Interactions Worker

A minimal Discord slash-command application implemented as a Cloudflare Worker with KV storage. The worker only handles interaction webhooks—no bot user or Gateway connection is required.

## Features

- Verifies Discord Ed25519 signatures for every request.
- Responds to `PING` interactions with `PONG` during the Discord webhook handshake.
- Implements `/set` and `/get` commands that reply ephemerally and scope data to each guild or DM.
- Persists key/value pairs in Cloudflare KV via the `MY_KV` binding.

## Setup

1. Create or open your Discord application at <https://discord.com/developers/applications>.
2. Record the **Application ID**, **Public Key**, and create a **Client Secret** if you do not already have one.
3. In Cloudflare, create a KV namespace and note its ID.
4. Update `wrangler.toml` with your values:
   ```toml
   [vars]
   DISCORD_PUBLIC_KEY = "your_public_key"
   DISCORD_APPLICATION_ID = "your_application_id"
   DISCORD_CLIENT_SECRET = "your_client_secret"
   DEV_GUILD_ID = "test_guild_id"

   [[kv_namespaces]]
   binding = "MY_KV"
   id = "your_namespace_id"
   ```
5. Install dependencies:
   ```bash
   npm install
   ```
6. Export the same values as environment variables when running scripts locally:
   ```bash
   export DISCORD_PUBLIC_KEY=...
   export DISCORD_APPLICATION_ID=...
   export DISCORD_CLIENT_SECRET=...
   export DEV_GUILD_ID=...
   ```

## Running & Development

- **Start remote development** (tunnels requests through Cloudflare, recommended for the Discord callback):
  ```bash
  npm run dev
  ```
- **Deploy to production**:
  ```bash
  npm run deploy
  ```

Set the **Interactions Endpoint URL** in the Discord Developer Portal to the public URL produced by `wrangler dev --remote` during development or to your deployed Worker URL in production.

## Command Registration

Guild commands are registered via Discord's client-credentials grant. Run:
```bash
npm run register
```
The script obtains a temporary token and updates commands for the guild specified by `DEV_GUILD_ID`. No bot token is required.

## Usage

1. Use `/set key hello value world` in your configured guild or DM. The worker stores the value under `g:<guild_id>:hello` (or `g:dm:hello` in DMs) and replies “Saved **hello**.”
2. Use `/get key hello` to retrieve the stored value. The worker responds with `**hello** → world`. If nothing is stored, it responds with “No value found for **hello**.”

## Security Notes

- Discord expects a response within 3 seconds. If you anticipate a longer operation, send a deferred response (type 5) and follow up with the interaction token.
- Replies are marked ephemeral so only the command invoker sees the data.
- Avoid logging raw request payloads, timestamps, or signatures to keep sensitive information out of logs.

## Troubleshooting

- **401 Unauthorized**: Verify the public key in `wrangler.toml` matches the value shown in the Discord Developer Portal.
- **Command not found**: Run `npm run register` after updating command definitions or when moving between guilds.

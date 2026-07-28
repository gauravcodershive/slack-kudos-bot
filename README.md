# /kudos — Slack Slash Command App

Lets teammates publicly recognize each other with a simple slash command:

```
/kudos @Sarah great work on the launch!
```

This posts a formatted public message to the channel:
> 🎉 @You gave kudos: @Sarah great work on the launch!

## Files
- `server.js` — Express server: OAuth install flow, signature verification, and the /kudos command handler
- `env-template.txt` — copy to `.env` and fill in your values

## Scopes requested (minimum necessary — matches Slack's review guidelines)
- `commands` — required to receive the /kudos slash command
- `chat:write` — required to post the resulting message

No message-reading scopes, no admin scopes, no access to private data.

## 1. Create a Slack app
1. Go to https://api.slack.com/apps → "Create New App" → "From scratch."
2. Name it (e.g. "Kudos") and pick your own development workspace (a free Slack workspace works fine for testing — you can create one at slack.com if needed).
3. Under **OAuth & Permissions**, add the two Bot Token Scopes: `commands` and `chat:write`.
4. Under **Basic Information**, copy your **Client ID**, **Client Secret**, and **Signing Secret** — you'll need these for your `.env` file.

## 2. Deploy the app (needs a public HTTPS URL)
Same as the BigCommerce app — free options: Render.com or Railway.app.
1. Push this folder to a GitHub repo.
2. Create a new Web Service on Render/Railway from that repo.
3. Set the environment variables from `env-template.txt`.
4. Deploy — you'll get a URL like `https://kudos-bot.onrender.com`. Use this as `APP_URL`.

## 3. Configure the Slack app with your deployed URL
1. Under **OAuth & Permissions**, set the Redirect URL to: `https://YOUR-DEPLOYED-URL/slack/oauth/callback`
2. Under **Slash Commands**, create a new command:
   - Command: `/kudos`
   - Request URL: `https://YOUR-DEPLOYED-URL/slack/kudos`
   - Short description: "Give a teammate public recognition"
   - Usage hint: `@teammate your message`

## 4. Install and test
1. Visit `https://YOUR-DEPLOYED-URL/slack/install` in your browser — this starts the OAuth flow.
2. Approve the permissions on your test workspace.
3. In Slack, type `/kudos @yourself nice testing!` in any channel — you should see the public kudos message appear.

## 5. Submit to the App Directory
1. In your Slack app's dashboard, go to **"Submit to App Directory"** (usually under Settings or Manage Distribution).
2. Fill in the listing info: description, icon, screenshots, and — importantly — a written justification for each of the two scopes requested (Slack explicitly asks for this).
3. Provide test account credentials/workspace access if requested, since reviewers install and test the app directly.
4. Submit. Review happens in two stages: a preliminary listing review (~1 week), then a functional review where a reviewer actually installs and tests it.

## Notes before wider release
- Replace the in-memory `teams` object with a real database — it currently resets on server restart.
- Consider adding a lightweight "leaderboard" or history view in a future version — but keep the first submission this simple and scope-minimal to reduce review friction.

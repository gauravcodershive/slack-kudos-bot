/**
 * /kudos — Slack Slash Command App
 *
 * Lets teammates publicly recognize each other:
 *   /kudos @Sarah great work on the launch!
 * posts a formatted public message to the channel where the command was run.
 *
 * Endpoints:
 *   GET  /slack/install         -> "Add to Slack" install link (OAuth start)
 *   GET  /slack/oauth/callback  -> OAuth redirect target, exchanges code for a bot token
 *   POST /slack/kudos           -> Slash command endpoint Slack calls on /kudos
 *
 * Scopes requested (minimum necessary):
 *   commands    - required to register and receive the /kudos slash command
 *   chat:write  - required to post the resulting kudos message to the channel
 *
 * Requires environment variables (see .env.example):
 *   SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET, APP_URL
 *
 * Team tokens are kept in-memory for demo purposes — replace with a real
 * database before using this with more than one workspace in production.
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();

const {
  SLACK_CLIENT_ID,
  SLACK_CLIENT_SECRET,
  SLACK_SIGNING_SECRET,
  APP_URL,
  PORT = 3000,
} = process.env;

// In-memory store: { [teamId]: { botToken } }
const teams = {};

/**
 * Slack requires the raw request body to verify the signature, so we
 * capture it here before express's normal body parsing.
 */
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.json());

/**
 * Verifies that a request genuinely came from Slack, using the signing
 * secret and Slack's HMAC signature scheme. Rejects anything that fails,
 * including stale requests (older than 5 minutes) to prevent replay attacks.
 */
function verifySlackSignature(req, res, next) {
  const timestamp = req.headers['x-slack-request-timestamp'];
  const slackSignature = req.headers['x-slack-signature'];

  if (!timestamp || !slackSignature) {
    return res.status(400).send('Missing Slack signature headers.');
  }

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (Number(timestamp) < fiveMinutesAgo) {
    return res.status(400).send('Request too old.');
  }

  const baseString = `v0:${timestamp}:${req.rawBody}`;
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
  hmac.update(baseString);
  const mySignature = `v0=${hmac.digest('hex')}`;

  const isValid = crypto.timingSafeEqual(
    Buffer.from(mySignature),
    Buffer.from(slackSignature)
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature.');
  }

  next();
}

/**
 * "Add to Slack" install link. Redirects the user to Slack's OAuth consent screen
 * with the minimum scopes requested.
 */
app.get('/slack/install', (req, res) => {
  const scopes = ['commands', 'chat:write'].join(',');
  const redirectUri = `${APP_URL}/slack/oauth/callback`;

  const installUrl =
    `https://slack.com/oauth/v2/authorize?` +
    `client_id=${SLACK_CLIENT_ID}` +
    `&scope=${scopes}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(installUrl);
});

/**
 * OAuth callback — exchanges the temporary code for a bot token and stores it
 * against the installing team's ID.
 */
app.get('/slack/oauth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Missing OAuth code.');
  }

  try {
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      null,
      {
        params: {
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          code,
          redirect_uri: `${APP_URL}/slack/oauth/callback`,
        },
      }
    );

    const data = response.data;

    if (!data.ok) {
      console.error('OAuth error:', data.error);
      return res.status(500).send('Installation failed. Check server logs.');
    }

    teams[data.team.id] = {
      botToken: data.access_token,
    };

    res.send('✅ /kudos was installed successfully! Head back to Slack and try /kudos @teammate great work!');
  } catch (err) {
    console.error('OAuth exchange failed:', err.response ? err.response.data : err.message);
    res.status(500).send('Installation failed. Check server logs.');
  }
});

/**
 * The /kudos slash command handler.
 *
 * Slack calls this endpoint synchronously and expects a response within 3
 * seconds. We post the public message directly and reply with a lightweight
 * confirmation.
 */
app.post('/slack/kudos', verifySlackSignature, async (req, res) => {
  const { team_id: teamId, channel_id: channelId, user_id: userId, text } = req.body;

  const team = teams[teamId];
  if (!team) {
    return res.json({
      response_type: 'ephemeral',
      text: 'This workspace needs to reinstall the app. Please contact your admin.',
    });
  }

  if (!text || !text.trim()) {
    return res.json({
      response_type: 'ephemeral',
      text: 'Usage: /kudos @teammate your message here',
    });
  }

  try {
    await axios.post(
      'https://slack.com/api/chat.postMessage',
      {
        channel: channelId,
        text: `🎉 <@${userId}> gave kudos: ${text}`,
      },
      {
        headers: {
          Authorization: `Bearer ${team.botToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Empty 200 response — the public message was already posted above,
    // so we don't need a separate visible reply to the command itself.
    res.status(200).send();
  } catch (err) {
    console.error('Failed to post kudos message:', err.response ? err.response.data : err.message);
    res.json({
      response_type: 'ephemeral',
      text: 'Something went wrong posting your kudos. Please try again.',
    });
  }
});

app.listen(PORT, () => console.log(`Kudos app running on port ${PORT}`));

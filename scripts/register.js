const requiredEnv = [
  'DISCORD_APPLICATION_ID',
  'DISCORD_CLIENT_SECRET',
  'DEV_GUILD_ID'
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

const applicationId = process.env.DISCORD_APPLICATION_ID;
const clientSecret = process.env.DISCORD_CLIENT_SECRET;
const guildId = process.env.DEV_GUILD_ID;

const commands = [
  {
    name: 'set',
    description: 'Store a value for this server or DM.',
    options: [
      {
        name: 'key',
        description: 'Key to set',
        type: 3,
        required: true
      },
      {
        name: 'value',
        description: 'Value to store',
        type: 3,
        required: true
      }
    ]
  },
  {
    name: 'get',
    description: 'Retrieve a stored value for this server or DM.',
    options: [
      {
        name: 'key',
        description: 'Key to look up',
        type: 3,
        required: true
      }
    ]
  }
];

async function main() {
  const token = await fetchAccessToken(applicationId, clientSecret);
  await registerCommands(applicationId, guildId, token, commands);
  console.log('Slash commands registered to guild successfully.');
}

async function fetchAccessToken(appId, secret) {
  const credentials = Buffer.from(`${appId}:${secret}`).toString('base64');
  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'applications.commands.update'
    }).toString()
  });

  if (!response.ok) {
    const body = await safeReadJson(response);
    const errorMessage = body?.error_description || body?.error || response.statusText;
    throw new Error(`Failed to obtain access token: ${errorMessage}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function registerCommands(appId, guildId, token, commands) {
  const response = await fetch(
    `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commands)
    }
  );

  if (!response.ok) {
    const body = await safeReadJson(response);
    const errorMessage = body?.message || response.statusText;
    throw new Error(`Failed to register commands: ${errorMessage}`);
  }
}

async function safeReadJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

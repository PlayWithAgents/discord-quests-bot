import nacl from 'tweetnacl';

const textEncoder = new TextEncoder();
const signatureHeader = 'x-signature-ed25519';
const timestampHeader = 'x-signature-timestamp';
const interactionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5
};
const responseFlags = {
  EPHEMERAL: 1 << 6
};

export default {
  async fetch(request, env, ctx) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get(signatureHeader);
    const timestamp = request.headers.get(timestampHeader);

    if (!signature || !timestamp) {
      return new Response('Missing signature headers', { status: 401 });
    }

    const body = await request.text();

    const isValid = verifySignature(body, signature, timestamp, env.DISCORD_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Invalid request signature', { status: 401 });
    }

    let interaction;
    try {
      interaction = JSON.parse(body);
    } catch (error) {
      return new Response('Invalid JSON body', { status: 400 });
    }

    if (interaction.type === 1) {
      return jsonResponse({ type: interactionResponseType.PONG });
    }

    if (interaction.type !== 2) {
      return new Response('Unsupported interaction type', { status: 400 });
    }

    try {
      const responseData = await handleApplicationCommand(interaction, env);
      return jsonResponse({
        type: interactionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          ...responseData,
          flags: responseFlags.EPHEMERAL
        }
      });
    } catch (error) {
      console.error('Interaction handling failed', error.message);
      return jsonResponse({
        type: interactionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: 'An unexpected error occurred. Please try again later.',
          flags: responseFlags.EPHEMERAL
        }
      }, 500);
    }
  }
};

function verifySignature(body, signature, timestamp, publicKey) {
  if (!publicKey) {
    console.error('DISCORD_PUBLIC_KEY not configured');
    return false;
  }

  try {
    const message = textEncoder.encode(timestamp + body);
    const signatureBytes = hexToUint8Array(signature);
    const publicKeyBytes = hexToUint8Array(publicKey);

    return nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('Failed to verify signature', error.message);
    return false;
  }
}

function hexToUint8Array(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }

  const array = new Uint8Array(hex.length / 2);
  for (let i = 0; i < array.length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error('Invalid hex string');
    }
    array[i] = byte;
  }
  return array;
}

async function handleApplicationCommand(interaction, env) {
  const { name, options = [] } = interaction.data ?? {};
  switch (name) {
    case 'set':
      return handleSetCommand(interaction, options, env);
    case 'get':
      return handleGetCommand(interaction, options, env);
    default:
      return { content: `Unknown command: ${name}` };
  }
}

function getScopedKey(interaction, key) {
  const guildId = interaction.guild_id || 'dm';
  return `g:${guildId}:${key}`;
}

function getOptionValue(options, optionName) {
  const option = options.find((opt) => opt.name === optionName);
  return option ? option.value : undefined;
}

async function handleSetCommand(interaction, options, env) {
  const key = getOptionValue(options, 'key');
  const value = getOptionValue(options, 'value');

  if (!key || !value) {
    return { content: 'Both key and value must be provided.' };
  }

  const storageKey = getScopedKey(interaction, key);
  await env.MY_KV.put(storageKey, value);

  return { content: `Saved **${escapeMarkdown(key)}**.` };
}

async function handleGetCommand(interaction, options, env) {
  const key = getOptionValue(options, 'key');

  if (!key) {
    return { content: 'Key must be provided.' };
  }

  const storageKey = getScopedKey(interaction, key);
  const value = await env.MY_KV.get(storageKey);

  if (value === null) {
    return { content: `No value found for **${escapeMarkdown(key)}**.` };
  }

  return { content: `**${escapeMarkdown(key)}** → ${escapeMarkdown(value)}` };
}

function escapeMarkdown(text) {
  return String(text).replace(/[\\*_`~]/g, (match) => `\\${match}`);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

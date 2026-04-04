export const config = { runtime: 'edge' };

export default async function handler(req) {
  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Allow requests from your domain only
  const origin = req.headers.get('origin') || '';
  const allowedOrigins = [
    'https://coachconnectpro.net',
    'https://www.coachconnectpro.net',
    'http://localhost:5173',  // local dev
    'http://localhost:3000'
  ];
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  try {
    const body = await req.json();
    const { imageBase64, mediaType } = body;

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: 'No image provided' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': corsOrigin
        }
      });
    }

    // Forward to Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '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',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType || 'image/jpeg',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: `This is a handwritten baseball lineup card. Extract every player from the batting order.
Return ONLY a JSON array, no other text, no markdown, no backticks. Example:
[{"num":"7","name":"Jake Smith"},{"num":"14","name":"Connor Lee"}]
If no jersey number is visible for a player use "". Include every player you can read.`
            }
          ]
        }]
      })
    });

    const data = await anthropicRes.json();
    const raw = data.content?.[0]?.text?.trim() || '';

    // Parse the player list
    let players;
    try {
      players = JSON.parse(raw);
    } catch (e) {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) players = JSON.parse(match[0]);
      else throw new Error('Could not parse player list from response');
    }

    return new Response(JSON.stringify({ players }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || 'Scan failed' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin
      }
    });
  }
}

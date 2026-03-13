/**
 * Serverless proxy para OpenRouter.
 *
 * La API key vive SOLO en las variables de entorno del servidor (Vercel),
 * nunca llega al bundle del frontend.
 *
 * Endpoint: POST /api/openrouter
 * Body: el mismo payload que se le mandaría a OpenRouter directamente.
 */
require('dotenv').config();

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENROUTER_API_KEY not configured on server' });
  }

  try {
    const payload = req.body;
    const isStreaming = payload?.stream === true;

    const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': req.headers['referer'] || req.headers['origin'] || '',
        'X-Title': 'Mbareté Inventory'
      },
      body: JSON.stringify(payload)
    });

    if (!upstream.ok) {
      const errorText = await upstream.text();
      return res.status(upstream.status).json({ error: errorText });
    }

    if (isStreaming) {
      // Pipe el stream de OpenRouter directo al cliente
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } else {
      const data = await upstream.json();
      res.status(200).json(data);
    }

  } catch (error) {
    console.error('OpenRouter proxy error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

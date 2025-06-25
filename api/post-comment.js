import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await client.connect();
    
    const { message, fightId } = req.body;

    if (!message || message.trim().length === 0) {
      await client.disconnect();
      return res.status(400).json({ error: 'Message required' });
    }

    if (message.length > 500) {
      await client.disconnect();
      return res.status(400).json({ error: 'Message too long' });
    }

    const commentId = Date.now() + Math.random().toString(36).substr(2, 9);
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    
    const comment = {
      id: commentId,
      message: message.trim(),
      timestamp,
      fightId: fightId || null,
      name: 'Anonymous'
    };

    // Store comment in Redis
    await client.lPush('comments', JSON.stringify(comment));
    await client.lTrim('comments', 0, 99);

    await client.disconnect();

    res.json({
      success: true,
      comment
    });

  } catch (error) {
    console.error('Post comment error:', error);
    try {
      await client.disconnect();
    } catch (e) {}
    res.status(500).json({ 
      error: 'Failed to post comment',
      details: error.message
    });
  }
}

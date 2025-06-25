import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Add CORS headers
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
    console.log('Posting comment, body:', req.body);
    
    const { message, fightId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message required' });
    }

    if (message.length > 500) {
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

    console.log('Storing comment:', comment);

    // Store comment in Redis
    await kv.lpush('comments', JSON.stringify(comment));
    await kv.ltrim('comments', 0, 99);

    console.log('Comment stored successfully');

    res.json({
      success: true,
      comment
    });

  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ 
      error: 'Failed to post comment',
      details: error.message,
      stack: error.stack 
    });
  }
}

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, fightId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message required' });
    }

    // Basic content filtering
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
      name: 'Anonymous' // Always anonymous
    };

    // Store comment in Redis (keep last 100 comments)
    await kv.lpush('comments', JSON.stringify(comment));
    await kv.ltrim('comments', 0, 99); // Keep only last 100

    res.json({
      success: true,
      comment
    });

  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ error: 'Failed to post comment' });
  }
}
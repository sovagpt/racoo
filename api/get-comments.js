import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // Get last 20 comments
    const comments = await kv.lrange('comments', 0, 19);
    
    const parsedComments = comments.map(comment => JSON.parse(comment));

    res.json(parsedComments);

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ error: 'Failed to get comments' });
  }
}
import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    await client.connect();
    
    // Get last 20 comments
    const comments = await client.lRange('comments', 0, 19);
    
    const parsedComments = comments.map(comment => JSON.parse(comment));

    await client.disconnect();
    
    res.json(parsedComments);

  } catch (error) {
    console.error('Get comments error:', error);
    try {
      await client.disconnect();
    } catch (e) {}
    res.status(500).json({ 
      error: 'Failed to get comments',
      details: error.message
    });
  }
}

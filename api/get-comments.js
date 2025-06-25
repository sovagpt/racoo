import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    console.log('Getting comments...');
    
    // Test KV connection
    const testKey = await kv.get('test');
    console.log('KV test result:', testKey);
    
    // Get last 20 comments
    const comments = await kv.lrange('comments', 0, 19);
    console.log('Comments from KV:', comments);
    
    const parsedComments = comments.map(comment => JSON.parse(comment));

    res.json(parsedComments);

  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ 
      error: 'Failed to get comments',
      details: error.message,
      stack: error.stack 
    });
  }
}

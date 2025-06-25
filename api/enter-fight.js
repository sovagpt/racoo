import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { raccoon } = req.body;

    if (!raccoon || !raccoon.name) {
      return res.status(400).json({ error: 'Raccoon data required' });
    }

    // Validate raccoon stats
    const validatedRaccoon = {
      name: raccoon.name.substring(0, 20), // Limit name length
      attack: Math.max(1, Math.min(20, raccoon.attack || 10)),
      defense: Math.max(1, Math.min(20, raccoon.defense || 10)),
      speed: Math.max(1, Math.min(20, raccoon.speed || 10)),
      traits: raccoon.traits || ['basic'],
      enteredAt: Date.now()
    };

    // Add to fight queue
    await kv.rpush('fight_queue', JSON.stringify(validatedRaccoon));

    // Get current queue length
    const queueLength = await kv.llen('fight_queue');

    res.json({
      success: true,
      message: `${raccoon.name} entered the fight queue`,
      queuePosition: queueLength
    });

  } catch (error) {
    console.error('Enter fight error:', error);
    res.status(500).json({ error: 'Failed to enter fight' });
  }
}
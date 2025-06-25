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
    
    // Get all completed fights (stored with completed: prefix)
    const fightKeys = await client.keys('completed_fight:*');
    
    // Sort by timestamp (newest first)
    fightKeys.sort((a, b) => {
      const timestampA = parseInt(a.split(':')[1]);
      const timestampB = parseInt(b.split(':')[1]);
      return timestampB - timestampA;
    });
    
    // Get last 50 fights
    const recentFightKeys = fightKeys.slice(0, 50);
    
    const fights = [];
    
    for (const fightKey of recentFightKeys) {
      try {
        const fightData = await client.hGetAll(fightKey);
        
        if (fightData && fightData.fighters && fightData.winner) {
          const fighters = JSON.parse(fightData.fighters);
          const fightLog = fightData.fightLog ? JSON.parse(fightData.fightLog) : [];
          
          // Generate mock transaction hash (in production, this would be real)
          const mockTxHash = generateMockTxHash();
          
          const fight = {
            id: fightKey.replace('completed_fight:', ''),
            date: new Date(parseInt(fightData.timestamp)).toLocaleString(),
            fighter1Name: fighters[0].name,
            fighter2Name: fighters[1].name,
            fighter1Image: fighters[0].image || null, // Will be populated when you have images
            fighter2Image: fighters[1].image || null, // Will be populated when you have images
            winner: fightData.winner,
            loser: fighters.find(f => f.name !== fightData.winner)?.name || 'Unknown',
            prize: fightData.prize || '0.00',
            result: fightData.result || 'Decision',
            txHash: fightData.txHash || mockTxHash,
            fightLog: fightLog,
            rounds: parseInt(fightData.rounds) || 5
          };
          
          fights.push(fight);
        }
      } catch (error) {
        console.error(`Error processing fight ${fightKey}:`, error);
        // Skip invalid fight data
      }
    }

    await client.disconnect();

    res.json({
      success: true,
      fights: fights,
      total: fights.length
    });

  } catch (error) {
    console.error('Get fight history error:', error);
    try {
      await client.disconnect();
    } catch (e) {}
    
    res.status(500).json({ 
      error: 'Failed to get fight history',
      details: error.message
    });
  }
}

// Generate mock Solana transaction hash
function generateMockTxHash() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

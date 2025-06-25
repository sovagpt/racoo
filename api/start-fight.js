import { Anthropic } from '@anthropic-ai/sdk';
import { createClient } from 'redis';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const client = createClient({
  url: process.env.REDIS_URL
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await client.connect();
    
    // Get two random raccoons from the fight queue
    const fightQueue = await client.lRange('fight_queue', 0, -1);
    
    if (fightQueue.length < 2) {
      // Create default raccoons if queue is empty
      const defaultFighters = [
        {
          name: `RandomRaccoon${Math.floor(Math.random() * 1000)}`,
          attack: Math.floor(Math.random() * 10) + 10,
          defense: Math.floor(Math.random() * 10) + 10,
          speed: Math.floor(Math.random() * 10) + 10,
          traits: ['basic_hat', 'normal_shirt']
        },
        {
          name: `TrashPanda${Math.floor(Math.random() * 1000)}`,
          attack: Math.floor(Math.random() * 10) + 10,
          defense: Math.floor(Math.random() * 10) + 10,
          speed: Math.floor(Math.random() * 10) + 10,
          traits: ['dumpster_crown', 'torn_hoodie']
        }
      ];
      
      const fightId = `fight_${Date.now()}`;
      
      // Store fight data
      await client.hSet(`fight:${fightId}`, {
        fighters: JSON.stringify(defaultFighters),
        status: 'starting',
        created: Date.now().toString()
      });

      await client.disconnect();

      // Start the fight generation in background
      generateFight(fightId, defaultFighters[0], defaultFighters[1]);

      return res.json({
        success: true,
        fightId,
        fighters: defaultFighters
      });
    }

    // Get first two raccoons from queue
    const fighter1Data = await client.lPop('fight_queue');
    const fighter2Data = await client.lPop('fight_queue');
    
    const fighter1 = JSON.parse(fighter1Data);
    const fighter2 = JSON.parse(fighter2Data);
    
    const fightId = `fight_${Date.now()}`;
    
    // Store fight data in Redis
    await client.hSet(`fight:${fightId}`, {
      fighters: JSON.stringify([fighter1, fighter2]),
      status: 'starting',
      created: Date.now().toString()
    });

    await client.disconnect();

    // Start the fight generation in background
    generateFight(fightId, fighter1, fighter2);

    res.json({
      success: true,
      fightId,
      fighters: [fighter1, fighter2]
    });

  } catch (error) {
    console.error('Start fight error:', error);
    try {
      await client.disconnect();
    } catch (e) {}
    res.status(500).json({ error: 'Failed to start fight' });
  }
}

async function generateFight(fightId, fighter1, fighter2) {
  const client = createClient({
    url: process.env.REDIS_URL
  });

  try {
    const prompt = `Generate a turn-based fight between two trash pandas (raccoons) with these stats:

Fighter 1: ${fighter1.name}
- Attack: ${fighter1.attack}
- Defense: ${fighter1.defense} 
- Speed: ${fighter1.speed}
- Traits: ${fighter1.traits.join(', ')}

Fighter 2: ${fighter2.name}
- Attack: ${fighter2.attack}
- Defense: ${fighter2.defense}
- Speed: ${fighter2.speed}  
- Traits: ${fighter2.traits.join(', ')}

Rules:
- Each raccoon starts with 100 HP
- Generate 5-8 rounds of combat
- Higher speed goes first each round
- Attack vs Defense determines damage (5-25 damage per hit)
- Include critical hits (double damage) occasionally
- Use raccoon-themed moves like "Trash Throw", "Dumpster Dive", "Midnight Strike", "Chaos Swipe"
- Make it entertaining with 4chan-style commentary
- End when one raccoon reaches 0 HP

Format each round as:
Round X: [Fighter] uses [Move] - [Result/Damage]

Return as JSON with this structure:
{
  "rounds": [
    {
      "round": 1,
      "action": "TrashKing uses GARBAGE SLAM",
      "damage": 15,
      "attacker": "TrashKing",
      "defender": "DumpsterLord", 
      "defenderHP": 85,
      "attackerHP": 100,
      "isCrit": false,
      "commentary": "A solid hit to start the fight!"
    }
  ],
  "winner": "TrashKing",
  "totalRounds": 6
}`;

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20241022',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const fightData = JSON.parse(response.content[0].text);
    
    await client.connect();
    
    // Store complete fight data
    await client.hSet(`fight:${fightId}`, {
      fightData: JSON.stringify(fightData),
      status: 'generated'
    });

    // Update daily and total fight counters
    const today = new Date().toISOString().split('T')[0];
    await client.incr(`fights_today:${today}`);
    await client.incr('total_fights_ever');
    
    // Set expiry on daily counter (expire tomorrow)
    await client.expireAt(`fights_today:${today}`, Math.floor(Date.now() / 1000) + 86400);

    await client.disconnect();

    console.log(`Fight ${fightId} generated successfully`);

  } catch (error) {
    console.error(`Fight generation error for ${fightId}:`, error);
    try {
      await client.connect();
      await client.hSet(`fight:${fightId}`, {
        status: 'error',
        error: error.message
      });
      await client.disconnect();
    } catch (e) {}
  }
}

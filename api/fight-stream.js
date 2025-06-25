import { createClient } from 'redis';

export default async function handler(req, res) {
  const { fightId } = req.query;

  if (!fightId) {
    return res.status(400).json({ error: 'Fight ID required' });
  }

  const client = createClient({
    url: process.env.REDIS_URL
  });

  // Set up Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  try {
    await client.connect();
    
    // Get fight data
    const fightData = await client.hGet(`fight:${fightId}`, 'fightData');
    const status = await client.hGet(`fight:${fightId}`, 'status');

    if (!fightData || status !== 'generated') {
      res.write(`data: ${JSON.stringify({ type: 'waiting', message: 'Fight generating...' })}\n\n`);
      
      await client.disconnect();
      
      // Poll for fight data
      const pollForFight = async () => {
        const pollClient = createClient({ url: process.env.REDIS_URL });
        await pollClient.connect();
        
        const data = await pollClient.hGet(`fight:${fightId}`, 'fightData');
        const currentStatus = await pollClient.hGet(`fight:${fightId}`, 'status');
        
        await pollClient.disconnect();
        
        if (data && currentStatus === 'generated') {
          streamFight(JSON.parse(data));
        } else if (currentStatus === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', message: 'Fight generation failed' })}\n\n`);
          res.end();
        } else {
          setTimeout(pollForFight, 1000);
        }
      };
      
      pollForFight();
      return;
    }

    await client.disconnect();
    streamFight(JSON.parse(fightData));

  } catch (error) {
    console.error('Fight stream error:', error);
    try {
      await client.disconnect();
    } catch (e) {}
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream error' })}\n\n`);
    res.end();
  }

  function streamFight(fight) {
    let roundIndex = 0;

    const streamNextRound = () => {
      if (roundIndex >= fight.rounds.length) {
        // Fight over
        res.write(`data: ${JSON.stringify({ 
          type: 'fight-end', 
          winner: fight.winner,
          prize: `$${(Math.random() * 50 + 10).toFixed(2)} TRASH`
        })}\n\n`);
        res.end();
        return;
      }

      const round = fight.rounds[roundIndex];
      
      res.write(`data: ${JSON.stringify({
        type: 'fight-action',
        message: `Round ${round.round}: ${round.action}${round.isCrit ? ' - CRITICAL HIT!' : ''}`,
        logType: round.isCrit ? 'crit' : (round.damage > 0 ? 'damage' : 'normal'),
        health: {
          fighter1: {
            current: round.attackerHP,
            max: 100,
            percentage: round.attackerHP
          },
          fighter2: {
            current: round.defenderHP, 
            max: 100,
            percentage: round.defenderHP
          }
        }
      })}\n\n`);

      roundIndex++;
      setTimeout(streamNextRound, 2000 + Math.random() * 2000);
    };

    // Start streaming
    res.write(`data: ${JSON.stringify({ type: 'fight-start', message: 'Fight begins!' })}\n\n`);
    setTimeout(streamNextRound, 1000);
  }

  // Clean up on client disconnect
  req.on('close', () => {
    res.end();
  });
}

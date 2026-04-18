import { MongoClient } from 'mongodb';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

async function run() {
  const mongoUri = 'mongodb://127.0.0.1:27017/tradereplay';
  const mongoClient = new MongoClient(mongoUri);
  const redisConnection = new IORedis({ maxRetriesPerRequest: null });
  const queue = new Queue('logo-enrichment', { connection: redisConnection });

  try {
    await mongoClient.connect();
    const db = mongoClient.db();
    const symbolsCol = db.collection('symbols');

    const query = {
      logoStatus: 'pending',
      $or: [{ iconUrl: { $exists: false } }, { iconUrl: null }, { iconUrl: '' }]
    };

    const cursor = symbolsCol.find(query).project({ symbol: 1, type: 1 });
    let count = 0;
    let batch: any[] = [];
    const BATCH_SIZE = 500;

    for await (const doc of cursor) {
      batch.push({
        name: 'symbol-logo-enrichment',
        data: { symbol: doc.symbol, type: doc.type },
        opts: { jobId: `logo-${doc.symbol}` }
      });

      if (batch.length >= BATCH_SIZE) {
        await queue.addBulk(batch);
        count += batch.length;
        if (count % 10000 === 0) console.log(`Enqueued ${count}...`);
        batch = [];
      }
    }

    if (batch.length > 0) {
      await queue.addBulk(batch);
      count += batch.length;
    }

    const jobCounts = await queue.getJobCounts();
    const depth = jobCounts.waiting + jobCounts.active + jobCounts.delayed;

    console.log(`TOTAL_ENQUEUED: ${count}, QUEUE_DEPTH: ${depth}`);

  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await mongoClient.close();
    await redisConnection.quit();
  }
}

run();

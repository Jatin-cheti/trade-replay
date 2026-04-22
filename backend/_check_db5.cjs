const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '.env') });

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradereplay';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('cleanassets');
  
  // Fine-grained priorityScore thresholds for India
  for (const t of [100, 105, 110, 115, 120, 125, 130, 140, 150, 160, 170, 180, 190, 200]) {
    const count = await col.countDocuments({ type: 'stock', country: 'IN', priorityScore: { $gte: t } });
    console.log(`India priorityScore >= ${t}: ${count}`);
  }
  
  // Combined: India + marketCap > 0 AND priorityScore > 100
  const combined = await col.countDocuments({ type: 'stock', country: 'IN', marketCap: { $gt: 0 }, priorityScore: { $gt: 100 } });
  console.log(`India marketCap>0 AND priorityScore>100: ${combined}`);
  
  // RELIANCE data
  const rel = await col.findOne({ symbol: 'RELIANCE', exchange: 'NSE' });
  console.log(`RELIANCE.NSE priorityScore: ${rel?.priorityScore}, marketCap: ${rel?.marketCap}, source: ${rel?.source}`);
  
  await mongoose.disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });

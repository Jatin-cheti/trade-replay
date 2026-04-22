const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '.env') });

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradereplay';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('cleanassets');
  
  // Check specific priorityScore thresholds for India stocks
  const thresholds = [0, 10, 50, 100, 200, 300, 400];
  for (const t of thresholds) {
    const count = await col.countDocuments({ type: 'stock', country: 'IN', priorityScore: { $gte: t } });
    console.log(`India priorityScore >= ${t}: ${count}`);
  }
  
  // Check by exchange
  const nse = await col.countDocuments({ type: 'stock', country: 'IN', exchange: 'NSE' });
  const bse = await col.countDocuments({ type: 'stock', country: 'IN', exchange: 'BSE' });
  const other = await col.countDocuments({ type: 'stock', country: 'IN', exchange: { $nin: ['NSE', 'BSE'] } });
  console.log(`India by exchange: NSE=${nse}, BSE=${bse}, other=${other}`);
  
  // Source-based check (e2e-seed)
  const e2eSeed = await col.countDocuments({ source: 'e2e-seed' });
  console.log(`E2E seed stocks: ${e2eSeed}`);
  
  // Global count for type=stocks in screener
  const globalStocks = await col.countDocuments({ type: 'stock' });
  console.log(`Global stocks: ${globalStocks}`);
  
  await mongoose.disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });

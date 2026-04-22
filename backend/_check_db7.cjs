const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '..', '.env') });

async function check() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/tradereplay';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('cleanassets');
  
  const etfTotal = await col.countDocuments({ type: 'etf' });
  const etfPri105 = await col.countDocuments({ type: 'etf', priorityScore: { $gte: 105 } });
  const etfPri0 = await col.countDocuments({ type: 'etf', priorityScore: { $gte: 0 } });
  
  console.log(`ETF total: ${etfTotal}`);
  console.log(`ETF priorityScore >= 105: ${etfPri105}`);
  console.log(`ETF priorityScore > 0: ${etfPri0}`);
  
  // Check all India seed stocks' priorityScores in the real DB
  const seedStocks = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ITC'];
  for (const sym of seedStocks) {
    const doc = await col.findOne({ symbol: sym, exchange: 'NSE' }, { projection: { _id:0, symbol:1, priorityScore:1 } });
    console.log(`${sym}.NSE priorityScore: ${doc?.priorityScore ?? 'NOT FOUND'}`);
  }
  
  await mongoose.disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '.env') });

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradereplay';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('cleanassets');
  
  const india = await col.countDocuments({ type: 'stock', country: 'IN' });
  const indiaLiquid = await col.countDocuments({ type: 'stock', country: 'IN', liquidityScore: { $gt: 0 } });
  const indiaPriority = await col.countDocuments({ type: 'stock', country: 'IN', priorityScore: { $gt: 0 } });
  const indiaHasMktCap = await col.countDocuments({ type: 'stock', country: 'IN', marketCap: { $gt: 0 } });
  const indiaPrimary = await col.countDocuments({ type: 'stock', country: 'IN', isPrimaryListing: true });
  const indiaVolume = await col.countDocuments({ type: 'stock', country: 'IN', volume: { $gt: 0 } });
  
  console.log('India stocks total:', india);
  console.log('India liquidityScore > 0:', indiaLiquid);
  console.log('India priorityScore > 0:', indiaPriority);
  console.log('India marketCap > 0:', indiaHasMktCap);
  console.log('India isPrimaryListing=true:', indiaPrimary);
  console.log('India volume > 0:', indiaVolume);
  
  // Also check the fullSymbol format - what prefix does RELIANCE have?
  const rel = await col.findOne({ symbol: 'RELIANCE', exchange: 'NSE' }, { projection: { _id: 0, symbol: 1, fullSymbol: 1, priorityScore: 1, liquidityScore: 1, isPrimaryListing: 1 } });
  console.log('RELIANCE.NSE record:', JSON.stringify(rel));
  
  await mongoose.disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });

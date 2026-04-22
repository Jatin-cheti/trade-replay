const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '.env') });

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradereplay';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('cleanassets');
  const total = await col.countDocuments({ type: { $in: ['stock','etf'] } });
  const india = await col.countDocuments({ type: { $in: ['stock','etf'] }, country: 'IN' });
  const us = await col.countDocuments({ type: { $in: ['stock','etf'] }, country: 'US' });
  const noCountry = await col.countDocuments({ type: { $in: ['stock','etf'] }, country: { $in: [null, '', undefined] } });
  console.log('total:', total, 'india:', india, 'us:', us, 'noCountry:', noCountry);
  const reliance = await col.find({ $or: [{ symbol: /reliance/i }, { name: /reliance/i }, { fullSymbol: /reliance/i }] }).project({symbol:1,name:1,country:1,marketCap:1,_id:0}).sort({marketCap:-1}).limit(5).toArray();
  console.log('reliance results:', JSON.stringify(reliance, null, 2));
  await mongoose.disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });

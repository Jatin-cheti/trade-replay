const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '.env') });

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradereplay';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('cleanassets');
  
  const globalPri105 = await col.countDocuments({ type: 'stock', priorityScore: { $gte: 105 } });
  const globalPri110 = await col.countDocuments({ type: 'stock', priorityScore: { $gte: 110 } });
  const globalPri100 = await col.countDocuments({ type: 'stock', priorityScore: { $gte: 100 } });
  const usPri105 = await col.countDocuments({ type: 'stock', country: 'US', priorityScore: { $gte: 105 } });
  const indiaPri105 = await col.countDocuments({ type: 'stock', country: 'IN', priorityScore: { $gte: 105 } });
  
  console.log(`Global stocks priorityScore >= 100: ${globalPri100}`);
  console.log(`Global stocks priorityScore >= 105: ${globalPri105}`);
  console.log(`Global stocks priorityScore >= 110: ${globalPri110}`);
  console.log(`US stocks priorityScore >= 105: ${usPri105}`);
  console.log(`India stocks priorityScore >= 105: ${indiaPri105}`);
  
  await mongoose.disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });

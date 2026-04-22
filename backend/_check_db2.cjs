const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: require('path').join(__dirname, '.env') });

async function check() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/tradereplay';
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const col = db.collection('cleanassets');
  
  const indiaTotal = await col.countDocuments({ type: 'stock', country: 'IN' });
  const indiaActive = await col.countDocuments({ type: 'stock', country: 'IN', isActive: true });
  const globalStock = await col.countDocuments({ type: 'stock' });
  const globalActive = await col.countDocuments({ type: 'stock', isActive: true });
  
  console.log('India stocks total:', indiaTotal);
  console.log('India stocks isActive=true:', indiaActive);
  console.log('Global stocks total:', globalStock);
  console.log('Global stocks isActive=true:', globalActive);
  
  // Also check RELIANCE name search results with sort
  const reliance = await col.find({ 
    $or: [{ symbol: /RELIANCE/i }, { name: /RELIANCE/i }, { fullSymbol: /RELIANCE/i }],
    type: 'stock'
  }).project({symbol:1,name:1,country:1,marketCap:1,fullSymbol:1,_id:0}).sort({marketCap:-1}).limit(5).toArray();
  console.log('RELIANCE search (name+symbol), top 5 by marketCap:');
  console.log(JSON.stringify(reliance, null, 2));
  
  // Symbol-only search for RELIANCE
  const relianceSymOnly = await col.find({ 
    $or: [{ symbol: /RELIANCE/i }, { fullSymbol: /RELIANCE/i }],
    type: 'stock'
  }).project({symbol:1,name:1,country:1,marketCap:1,fullSymbol:1,_id:0}).sort({marketCap:-1}).limit(5).toArray();
  console.log('RELIANCE search (symbol+fullSymbol only), top 5 by marketCap:');
  console.log(JSON.stringify(relianceSymOnly, null, 2));
  
  await mongoose.disconnect();
}
check().catch(e => { console.error(e.message); process.exit(1); });

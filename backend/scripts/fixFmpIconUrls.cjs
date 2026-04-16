const {MongoClient}=require('mongodb');
(async()=>{
  const c=await MongoClient.connect('mongodb://127.0.0.1:27017');
  const db=c.db('tradereplay');
  
  // Find all symbols with good companyDomain but FMP image-stock iconUrl
  const cursor=db.collection('symbols').find({
    companyDomain:{$exists:true,$ne:''},
    iconUrl:{$regex:/financialmodelingprep\.com\/image-stock/}
  },{projection:{symbol:1,companyDomain:1,iconUrl:1}});
  
  const ops=[];
  let count=0;
  for await(const doc of cursor){
    const newUrl=`https://www.google.com/s2/favicons?domain=${doc.companyDomain}&sz=128`;
    ops.push({updateOne:{filter:{_id:doc._id},update:{$set:{iconUrl:newUrl,logoVerificationStatus:'validated'}}}});
    count++;
    if(ops.length>=500){
      await db.collection('symbols').bulkWrite(ops);
      ops.length=0;
      console.log(`Fixed ${count} so far...`);
    }
  }
  if(ops.length>0){
    await db.collection('symbols').bulkWrite(ops);
  }
  console.log(`\nDone! Fixed ${count} symbols: FMP image-stock → Google Favicons`);
  c.close();
})()

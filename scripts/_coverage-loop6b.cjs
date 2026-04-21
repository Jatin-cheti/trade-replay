const {MongoClient}=require("mongodb");
(async()=>{
  const c=await MongoClient.connect("mongodb://10.122.0.2:27017/tradereplay");
  const db=c.db();
  const col=db.collection("cleanassets");
  const rep = async (label, q) => {
    const t = await col.countDocuments(q);
    const w = await col.countDocuments({...q, iconUrl:{$exists:true,$nin:["",null]}});
    console.log(label.padEnd(20), "total=", t, "icon=", w, (t?(w/t*100).toFixed(1):0)+"%");
  };
  await rep("Global active", {isActive:true});
  await rep("US stock", {country:"US", type:"stock", isActive:true});
  await rep("IN stock", {country:"IN", type:"stock", isActive:true});
  await rep("NSE stock", {exchange:"NSE", country:"IN", type:"stock", isActive:true});
  await rep("BSE stock", {exchange:"BSE", country:"IN", type:"stock", isActive:true});
  // top 500 by mcap
  const top = await col.find({isActive:true, marketCap:{$gt:0}}, {projection:{iconUrl:1}}).sort({marketCap:-1}).limit(500).toArray();
  const topIcon = top.filter(x => x.iconUrl && x.iconUrl !== "").length;
  console.log("Top500 by mcap     total= 500 icon=", topIcon, (topIcon/5).toFixed(1)+"%");
  await c.close();
})();

const mongoose = require("mongoose");
async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/tradereplay");
  const S = mongoose.connection.collection("symbols");
  const total = await S.countDocuments();
  const withIcon = await S.countDocuments({iconUrl:{$ne:""}});
  const withS3 = await S.countDocuments({s3Icon:{$ne:""}});
  const withDomain = await S.countDocuments({companyDomain:{$ne:""}});
  const validated = await S.countDocuments({logoValidatedAt:{$ne:null}});
  const noIcon = await S.countDocuments({$or:[{iconUrl:""},{iconUrl:null},{iconUrl:{$exists:false}}]});
  const byType = await S.aggregate([{$group:{_id:"$type",total:{$sum:1},withLogo:{$sum:{$cond:[{$and:[{$ne:["$iconUrl",""]},{$ne:["$iconUrl",null]}]},1,0]}}}}]).toArray();
  const top = await S.find({iconUrl:{$ne:""}},{projection:{symbol:1,fullSymbol:1,name:1,type:1,iconUrl:1,companyDomain:1,_id:0}}).sort({priorityScore:-1}).limit(10).toArray();
  const missing = await S.find({$or:[{iconUrl:""},{iconUrl:null}]},{projection:{symbol:1,fullSymbol:1,name:1,type:1,_id:0}}).sort({priorityScore:-1}).limit(10).toArray();
  console.log(JSON.stringify({total,withIcon,withS3,withDomain,validated,noIcon,byType,top,missing},null,2));
  process.exit(0);
}
main().catch(e=>{console.error(e.message);process.exit(1)});
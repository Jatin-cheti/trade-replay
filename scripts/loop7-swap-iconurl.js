// Loop 7: swap dead clearbit/logo.dev iconUrl values to s3Icon where available.
var r1 = db.cleanassets.updateMany(
  {
    s3Icon: { $exists: true, $nin: [null, ""] },
    $or: [
      { iconUrl: /clearbit/ },
      { iconUrl: /img\.logo\.dev/ },
      { iconUrl: null },
      { iconUrl: "" },
    ],
  },
  [{ $set: { iconUrl: "$s3Icon" } }]
);
print("swap_s3Icon_modified: " + r1.modifiedCount);

var total = db.cleanassets.countDocuments({});
var withLogo = db.cleanassets.countDocuments({
  iconUrl: { $exists: true, $nin: [null, ""] },
});
var deadLogo = db.cleanassets.countDocuments({
  iconUrl: /clearbit|img\.logo\.dev/,
});
var withS3 = db.cleanassets.countDocuments({
  s3Icon: { $exists: true, $nin: [null, ""] },
});
print(
  "total:" +
    total +
    " withLogo:" +
    withLogo +
    " stillDead:" +
    deadLogo +
    " withS3:" +
    withS3
);

// Sample top 5 high-marketcap rows to show current state
var samples = db.cleanassets
  .find(
    { iconUrl: { $exists: true, $nin: [null, ""] } },
    { symbol: 1, iconUrl: 1, s3Icon: 1 }
  )
  .sort({ marketCap: -1 })
  .limit(5)
  .toArray();
samples.forEach(function (s) {
  print(
    s.symbol +
      " | icon=" +
      (s.iconUrl || "").substring(0, 70) +
      " | s3=" +
      (s.s3Icon || "EMPTY").substring(0, 40)
  );
});

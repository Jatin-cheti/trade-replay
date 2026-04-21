const L = require("/tmp/leaks.json");
const agg = {};
L.forEach(l => { const k = l.RuleID + " | " + l.File; agg[k] = (agg[k] || 0) + 1; });
console.log("Total:", L.length);
Object.entries(agg).sort((a,b) => b[1]-a[1]).slice(0, 25).forEach(([k,v]) => console.log(v, k));
console.log("\n--- Sample first 5 ---");
L.slice(0, 5).forEach(l => {
  console.log(`[${l.RuleID}] ${l.File}:${l.StartLine} -- ${(l.Secret||"").slice(0,40)}... -- match: ${(l.Match||"").slice(0,80)}`);
});

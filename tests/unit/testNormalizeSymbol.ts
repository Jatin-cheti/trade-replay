import { normalizeSymbol } from "../utils/normalizeSymbol";

const testCases = [
  "NSE:TCS",
  "TCS-EQ",
  "TCS.NS",
  "BAJAJ-AUTO",
  "BAJAJAUTO",
];

testCases.forEach((value) => {
  console.log(value, normalizeSymbol(value));
});

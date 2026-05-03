/**
 * TV-Parity 500 Tests — Gann Square Fixed (1-anchor click, family='fib').
 * Rail: rail-fib. isPointOnly=true, anchorCount=1.
 * Fixed 200×200 px square anchored at the click point; 9 angular rays at slopes
 * 1/8, 1/4, 1/3, 1/2, 1/1, 2/1, 3/1, 4/1, 8/1 with ratio labels at endpoints.
 */
import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({
  variant: "gannSquareFixed",
  testId: "gann-square-fixed",
  railTestId: "rail-fib",
  anchorCount: 1,
  commitMode: "click",
});

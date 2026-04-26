/**
 * TV-Parity 500 Tests — TREND tool
 *
 * Uses the shared 500-test factory. 2-anchor drag-commit trend line.
 * Originally the source of the factory; trend has reached 500/500 on prod.
 */

import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({ variant: "trend", testId: "tool-trendline" });

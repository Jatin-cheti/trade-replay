/**
 * TV-Parity 500 Tests — RAY tool
 *
 * Uses the shared 500-test factory. 2-anchor drag-commit ray.
 */

import { register500ToolSuite } from "./tv-parity-500-factory";

register500ToolSuite({ variant: "ray", testId: "tool-ray" });

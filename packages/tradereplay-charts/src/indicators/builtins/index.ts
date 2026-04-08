/**
 * Auto-registers all built-in indicators.
 *
 * Import this module once (done automatically by createChart.ts) to ensure
 * SMA, EMA, RSI, and MACD are available via `getIndicator()`.
 *
 * Calling `registerBuiltins()` multiple times is safe — a guard flag
 * prevents duplicate registration.
 */

import { registerIndicator } from '../registry.ts';
import { smaDef }  from './sma.ts';
import { emaDef }  from './ema.ts';
import { rsiDef }  from './rsi.ts';
import { macdDef } from './macd.ts';
import { wmaDef } from './wma.ts';
import { vwapDef } from './vwap.ts';
import { bbandsDef } from './bbands.ts';
import { donchianDef } from './donchian.ts';
import { keltnerDef } from './keltner.ts';
import { atrDef } from './atr.ts';
import { supertrendDef } from './supertrend.ts';
import { psarDef } from './psar.ts';
import { pivotDef } from './pivot.ts';
import { stochasticDef } from './stochastic.ts';
import { cciDef } from './cci.ts';
import { rocDef } from './roc.ts';
import { momentumDef } from './momentum.ts';
import { williamsRDef } from './williamsR.ts';
import { mfiDef } from './mfi.ts';
import { obvDef } from './obv.ts';
import { cmfDef } from './cmf.ts';
import { adxDef } from './adx.ts';
import { aroonDef } from './aroon.ts';
import { trixDef } from './trix.ts';
import { ultimateDef } from './ultimate.ts';
import { chaikinOscDef } from './chaikinOsc.ts';
import { awesomeDef } from './awesome.ts';
import { dpoDef } from './dpo.ts';
import { ichimokuDef } from './ichimoku.ts';

let _registered = false;

export function registerBuiltins(): void {
  if (_registered) return;
  _registered = true;
  registerIndicator(smaDef);
  registerIndicator(emaDef);
  registerIndicator(rsiDef);
  registerIndicator(macdDef);
  registerIndicator(wmaDef);
  registerIndicator(vwapDef);
  registerIndicator(bbandsDef);
  registerIndicator(donchianDef);
  registerIndicator(keltnerDef);
  registerIndicator(atrDef);
  registerIndicator(supertrendDef);
  registerIndicator(psarDef);
  registerIndicator(pivotDef);
  registerIndicator(stochasticDef);
  registerIndicator(cciDef);
  registerIndicator(rocDef);
  registerIndicator(momentumDef);
  registerIndicator(williamsRDef);
  registerIndicator(mfiDef);
  registerIndicator(obvDef);
  registerIndicator(cmfDef);
  registerIndicator(adxDef);
  registerIndicator(aroonDef);
  registerIndicator(trixDef);
  registerIndicator(ultimateDef);
  registerIndicator(chaikinOscDef);
  registerIndicator(awesomeDef);
  registerIndicator(dpoDef);
  registerIndicator(ichimokuDef);
}

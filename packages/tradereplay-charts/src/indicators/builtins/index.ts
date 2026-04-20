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
import {
  hmaDef,
  demaDef,
  temaDef,
  zlemaDef,
  kamaDef,
  almaDef,
  lsmaDef,
  stochRsiDef,
  rviDef,
  ppoDef,
  pvoDef,
  tsiDef,
  dxDef,
  crsiDef,
  elderRayDef,
  cmoDef,
  fisherDef,
  kdjDef,
  bollingerPercentBDef,
  bollingerBandwidthDef,
  chaikinVolatilityDef,
  stddevDef,
  varianceDef,
  adlDef,
  forceIndexDef,
  eomDef,
  nviDef,
  pviDef,
  vptDef,
  aroonOscillatorDef,
  vortexDef,
} from './batch2.ts';
import {
  trimaDef,
  smmaDef,
  apoDef,
  smiDef,
  choppinessDef,
  ulcerIndexDef,
  massIndexDef,
  qstickDef,
  relativeVolumeDef,
  balanceOfPowerDef,
  emvOscDef,
  volatilityRatioDef,
  linearRegSlopeDef,
  linearRegInterceptDef,
  linearRegAngleDef,
  priceChannelMidDef,
  medianPriceDef,
  typicalPriceDef,
  weightedCloseDef,
  volumeOscillatorDef,
} from './batch3.ts';
import {
  coppockCurveDef,
  percentileRankDef,
  normalizedAtrDef,
  priceChannelWidthDef,
  closeLocationValueDef,
  candleBodyDef,
  candleBodyPercentDef,
  upperWickDef,
  lowerWickDef,
  trueRangePercentDef,
  rollingHighDef,
  rollingLowDef,
  volumeZScoreDef,
  volumeSmaRatioDef,
  rangeSmaRatioDef,
  cumulativeVolumeDeltaDef,
  rollingReturnDef,
  logReturnDef,
  volatilityEmaDef,
  breakoutStrengthDef,
  trendStrengthDef,
} from './batch4.ts';
import {
  fractalDef,
  alligatorDef,
  gatorDef,
  mfiWilliamsDef,
} from './billWilliams.ts';
import {
  cpDojiDef,
  cpHammerDef,
  cpShootingStarDef,
  cpEngulfingDef,
  cpMorningStarDef,
  cpEveningStarDef,
  cpHaramiDef,
  cpThreeWhiteSoldiersDef,
  cpThreeBlackCrowsDef,
  cpSpinningTopDef,
  cpMarubozuDef,
  cpPiercingLineDef,
  cpDarkCloudDef,
  cpTweezerDef,
} from './candlePatterns.ts';
import {
  volume24hDef,
  advDeclineRatioDef,
  advDeclineRatioBarsDef,
  autoFibRetracementDef,
  autoFibExtensionDef,
  autoPitchforkDef,
  autoTrendlinesDef,
  avgDailyRangeDef,
  bbTrendDef,
  bollingerBarsDef,
  chandeKrollStopDef,
  chandelierExitDef,
  chopZoneDef,
  correlationCoeffDef,
  cumulativeVolumeIndexDef,
  klingerOscDef,
  knowSureThingDef,
  linearRegChannelDef,
  maCrossDef,
  mcginleyDynamicDef,
  maRibbonDef,
  netVolumeDef,
  performanceDef,
  pivotHighLowDef,
  priceMomentumOscDef,
  pringsSpecialKDef,
  rankCorrelationDef,
  rciRibbonDef,
  relativeVolatilityIndexDef,
  robBookerPivotsDef,
  robBookerKnoxvilleDef,
  robBookerMissedPivotsDef,
  robBookerReversalDef,
  robBookerZivGhostDef,
  rsiDivergenceDef,
  smiErgodicDef,
  smiErgodicOscDef,
  twapDef,
  tradingSessionsDef,
  visibleAvgPriceDef,
  volatilityStopDef,
  volumeDef,
  volumeDeltaDef,
  vwmaDef,
  vwapAutoAnchoredDef,
  woodiesCciDef,
  zigZagDef,
  moonPhasesDef,
  multiTimePeriodDef,
  openInterestDef,
  priceTargetDef,
  seasonalityDef,
  technicalRatingsDef,
  relativeVolumeAtTimeDef,
} from './batch5.ts';
import { allStrategies } from './strategies.ts';
import { allProfiles } from './profiles.ts';
import { allChartPatterns } from './chartPatterns.ts';
import {
  cpAbandonedBabyDef,
  cpDojiStarDef,
  cpDownsideTasukiGapDef,
  cpDragonflyDojiDef,
  cpGravestoneDojiDef,
  cpHangingManDef,
  cpInvertedHammerDef,
  cpKickingDef,
  cpLongLowerShadowDef,
  cpLongUpperShadowDef,
  cpMarubozuBlackDef,
  cpMarubozuWhiteDef,
  cpRisingFallingThreeDef,
  cpSpinningTopBlackDef,
  cpSpinningTopWhiteDef,
  cpThreeInsideDef,
  cpThreeOutsideDef,
  cpTriStarDef,
  cpTweezerTopDef,
  cpTweezerBottomDef,
  cpUpsideTasukiGapDef,
  cpRisingWindowDef,
  cpFallingWindowDef,
  cpBeltHoldDef,
  cpCounterattackDef,
  cpHaramiCrossDef,
  cpHomingPigeonDef,
  cpLadderBottomDef,
  cpMatchingLowDef,
  cpStickSandwichDef,
  cpTasukiLineDef,
  cpThreeStarsInSouthDef,
  cpUniqueThreeRiverDef,
} from './candlePatterns2.ts';
import { allStubs } from './stubs.ts';

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
  registerIndicator(hmaDef);
  registerIndicator(demaDef);
  registerIndicator(temaDef);
  registerIndicator(zlemaDef);
  registerIndicator(kamaDef);
  registerIndicator(almaDef);
  registerIndicator(lsmaDef);
  registerIndicator(stochRsiDef);
  registerIndicator(rviDef);
  registerIndicator(ppoDef);
  registerIndicator(pvoDef);
  registerIndicator(tsiDef);
  registerIndicator(dxDef);
  registerIndicator(crsiDef);
  registerIndicator(elderRayDef);
  registerIndicator(cmoDef);
  registerIndicator(fisherDef);
  registerIndicator(kdjDef);
  registerIndicator(bollingerPercentBDef);
  registerIndicator(bollingerBandwidthDef);
  registerIndicator(chaikinVolatilityDef);
  registerIndicator(stddevDef);
  registerIndicator(varianceDef);
  registerIndicator(adlDef);
  registerIndicator(forceIndexDef);
  registerIndicator(eomDef);
  registerIndicator(nviDef);
  registerIndicator(pviDef);
  registerIndicator(vptDef);
  registerIndicator(aroonOscillatorDef);
  registerIndicator(vortexDef);
  registerIndicator(trimaDef);
  registerIndicator(smmaDef);
  registerIndicator(apoDef);
  registerIndicator(smiDef);
  registerIndicator(choppinessDef);
  registerIndicator(ulcerIndexDef);
  registerIndicator(massIndexDef);
  registerIndicator(qstickDef);
  registerIndicator(relativeVolumeDef);
  registerIndicator(balanceOfPowerDef);
  registerIndicator(emvOscDef);
  registerIndicator(volatilityRatioDef);
  registerIndicator(linearRegSlopeDef);
  registerIndicator(linearRegInterceptDef);
  registerIndicator(linearRegAngleDef);
  registerIndicator(priceChannelMidDef);
  registerIndicator(medianPriceDef);
  registerIndicator(typicalPriceDef);
  registerIndicator(weightedCloseDef);
  registerIndicator(volumeOscillatorDef);
  registerIndicator(coppockCurveDef);
  registerIndicator(percentileRankDef);
  registerIndicator(normalizedAtrDef);
  registerIndicator(priceChannelWidthDef);
  registerIndicator(closeLocationValueDef);
  registerIndicator(candleBodyDef);
  registerIndicator(candleBodyPercentDef);
  registerIndicator(upperWickDef);
  registerIndicator(lowerWickDef);
  registerIndicator(trueRangePercentDef);
  registerIndicator(rollingHighDef);
  registerIndicator(rollingLowDef);
  registerIndicator(volumeZScoreDef);
  registerIndicator(volumeSmaRatioDef);
  registerIndicator(rangeSmaRatioDef);
  registerIndicator(cumulativeVolumeDeltaDef);
  registerIndicator(rollingReturnDef);
  registerIndicator(logReturnDef);
  registerIndicator(volatilityEmaDef);
  registerIndicator(breakoutStrengthDef);
  registerIndicator(trendStrengthDef);
  // Bill Williams
  registerIndicator(fractalDef);
  registerIndicator(alligatorDef);
  registerIndicator(gatorDef);
  registerIndicator(mfiWilliamsDef);
  // Candlestick Patterns
  registerIndicator(cpDojiDef);
  registerIndicator(cpHammerDef);
  registerIndicator(cpShootingStarDef);
  registerIndicator(cpEngulfingDef);
  registerIndicator(cpMorningStarDef);
  registerIndicator(cpEveningStarDef);
  registerIndicator(cpHaramiDef);
  registerIndicator(cpThreeWhiteSoldiersDef);
  registerIndicator(cpThreeBlackCrowsDef);
  registerIndicator(cpSpinningTopDef);
  registerIndicator(cpMarubozuDef);
  registerIndicator(cpPiercingLineDef);
  registerIndicator(cpDarkCloudDef);
  registerIndicator(cpTweezerDef);
  // Batch 5 indicators
  registerIndicator(volume24hDef);
  registerIndicator(advDeclineRatioDef);
  registerIndicator(advDeclineRatioBarsDef);
  registerIndicator(autoFibRetracementDef);
  registerIndicator(autoFibExtensionDef);
  registerIndicator(autoPitchforkDef);
  registerIndicator(autoTrendlinesDef);
  registerIndicator(avgDailyRangeDef);
  registerIndicator(bbTrendDef);
  registerIndicator(bollingerBarsDef);
  registerIndicator(chandeKrollStopDef);
  registerIndicator(chandelierExitDef);
  registerIndicator(chopZoneDef);
  registerIndicator(correlationCoeffDef);
  registerIndicator(cumulativeVolumeIndexDef);
  registerIndicator(klingerOscDef);
  registerIndicator(knowSureThingDef);
  registerIndicator(linearRegChannelDef);
  registerIndicator(maCrossDef);
  registerIndicator(mcginleyDynamicDef);
  registerIndicator(maRibbonDef);
  registerIndicator(netVolumeDef);
  registerIndicator(performanceDef);
  registerIndicator(pivotHighLowDef);
  registerIndicator(priceMomentumOscDef);
  registerIndicator(pringsSpecialKDef);
  registerIndicator(rankCorrelationDef);
  registerIndicator(rciRibbonDef);
  registerIndicator(relativeVolatilityIndexDef);
  registerIndicator(robBookerPivotsDef);
  registerIndicator(robBookerKnoxvilleDef);
  registerIndicator(robBookerMissedPivotsDef);
  registerIndicator(robBookerReversalDef);
  registerIndicator(robBookerZivGhostDef);
  registerIndicator(rsiDivergenceDef);
  registerIndicator(smiErgodicDef);
  registerIndicator(smiErgodicOscDef);
  registerIndicator(twapDef);
  registerIndicator(tradingSessionsDef);
  registerIndicator(visibleAvgPriceDef);
  registerIndicator(volatilityStopDef);
  registerIndicator(volumeDef);
  registerIndicator(volumeDeltaDef);
  registerIndicator(vwmaDef);
  registerIndicator(vwapAutoAnchoredDef);
  registerIndicator(woodiesCciDef);
  registerIndicator(zigZagDef);
  registerIndicator(moonPhasesDef);
  registerIndicator(multiTimePeriodDef);
  registerIndicator(openInterestDef);
  registerIndicator(priceTargetDef);
  registerIndicator(seasonalityDef);
  registerIndicator(technicalRatingsDef);
  registerIndicator(relativeVolumeAtTimeDef);
  // Candlestick Patterns (batch 2)
  registerIndicator(cpAbandonedBabyDef);
  registerIndicator(cpDojiStarDef);
  registerIndicator(cpDownsideTasukiGapDef);
  registerIndicator(cpDragonflyDojiDef);
  registerIndicator(cpGravestoneDojiDef);
  registerIndicator(cpHangingManDef);
  registerIndicator(cpInvertedHammerDef);
  registerIndicator(cpKickingDef);
  registerIndicator(cpLongLowerShadowDef);
  registerIndicator(cpLongUpperShadowDef);
  registerIndicator(cpMarubozuBlackDef);
  registerIndicator(cpMarubozuWhiteDef);
  registerIndicator(cpRisingFallingThreeDef);
  registerIndicator(cpSpinningTopBlackDef);
  registerIndicator(cpSpinningTopWhiteDef);
  registerIndicator(cpThreeInsideDef);
  registerIndicator(cpThreeOutsideDef);
  registerIndicator(cpTriStarDef);
  registerIndicator(cpTweezerTopDef);
  registerIndicator(cpTweezerBottomDef);
  registerIndicator(cpUpsideTasukiGapDef);
  registerIndicator(cpRisingWindowDef);
  registerIndicator(cpFallingWindowDef);
  registerIndicator(cpBeltHoldDef);
  registerIndicator(cpCounterattackDef);
  registerIndicator(cpHaramiCrossDef);
  registerIndicator(cpHomingPigeonDef);
  registerIndicator(cpLadderBottomDef);
  registerIndicator(cpMatchingLowDef);
  registerIndicator(cpStickSandwichDef);
  registerIndicator(cpTasukiLineDef);
  registerIndicator(cpThreeStarsInSouthDef);
  registerIndicator(cpUniqueThreeRiverDef);
  // Strategies
  for (const def of allStrategies) registerIndicator(def);
  // Profiles
  for (const def of allProfiles) registerIndicator(def);
  // Chart Patterns
  for (const def of allChartPatterns) registerIndicator(def);
  // Stubs (financials, fundamentals, community, breadth)
  for (const def of allStubs) registerIndicator(def);
}

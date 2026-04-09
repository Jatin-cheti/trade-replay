import * as Charts from "@tradereplay/charts";
const INDICATOR_DEFS = new Map(Object.values(Charts)
    .filter((value) => {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    return typeof candidate.id === "string"
        && typeof candidate.compute === "function"
        && Array.isArray(candidate.inputs)
        && Array.isArray(candidate.outputs);
})
    .map((def) => [def.id, def]));
function normalizeCandles(candles) {
    return candles
        .map((row) => ({
        time: Number(row.time),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: row.volume == null ? undefined : Number(row.volume),
    }))
        .filter((row) => Number.isFinite(row.time) && Number.isFinite(row.open) && Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close));
}
function toComputeContext(candles, params) {
    return {
        times: candles.map((c) => c.time),
        open: candles.map((c) => c.open),
        high: candles.map((c) => c.high),
        low: candles.map((c) => c.low),
        close: candles.map((c) => c.close),
        volume: candles.map((c) => c.volume ?? null),
        params,
    };
}
export function computeIndicators(input) {
    const candles = normalizeCandles(input.candles);
    const indicatorResults = input.indicators.map((item) => {
        const def = INDICATOR_DEFS.get(item.id);
        if (!def) {
            throw new Error(`UNKNOWN_INDICATOR:${item.id}`);
        }
        const params = {};
        for (const spec of def.inputs) {
            const raw = item.params?.[spec.name];
            params[spec.name] = Number.isFinite(raw) ? Number(raw) : spec.default;
        }
        const result = def.compute(toComputeContext(candles, params));
        return {
            id: def.id,
            name: def.name,
            params,
            outputs: def.outputs.map((output, idx) => ({
                ...output,
                values: result.outputs[idx] ?? [],
            })),
        };
    });
    return {
        candlesCount: candles.length,
        indicators: indicatorResults,
    };
}
export function transformCandles(input) {
    const candles = normalizeCandles(input.candles);
    let transformed = candles;
    switch (input.transformType) {
        case "renko":
            transformed = Charts.renkoTransform(candles, Number(input.params?.boxSize));
            break;
        case "rangeBars":
            transformed = Charts.rangeBarsTransform(candles, Number(input.params?.rangeSize));
            break;
        case "lineBreak":
            transformed = Charts.lineBreakTransform(candles, Math.max(2, Math.round(Number(input.params?.lines ?? 3))));
            break;
        case "kagi":
            transformed = Charts.kagiTransform(candles, Number(input.params?.reversal));
            break;
        case "pointFigure":
            transformed = Charts.pointFigureTransform(candles, Number(input.params?.boxSize), Math.max(2, Math.round(Number(input.params?.reversalBoxes ?? 3))));
            break;
        case "brick":
            transformed = Charts.brickTransform(candles, Number(input.params?.boxSize));
            break;
        default:
            transformed = candles;
            break;
    }
    return {
        candlesCount: candles.length,
        transformedCount: transformed.length,
        transformType: input.transformType,
        candles: transformed,
    };
}

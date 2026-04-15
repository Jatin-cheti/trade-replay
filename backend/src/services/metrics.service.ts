type LatencyBucket = {
  count: number;
  totalMs: number;
  maxMs: number;
};

type CacheBucket = {
  hits: number;
  misses: number;
};

const apiLatency: Record<string, LatencyBucket> = {};
const cacheStats: Record<string, CacheBucket> = {};
const queueStats: Record<string, { samples: number; avgLatencyMs: number; maxLatencyMs: number }> = {};
const iconQuality = {
  realIcons: 0,
  fallbackIcons: 0,
};
const symbolSearchLatency = {
  samples: 0,
  totalMs: 0,
  p50Window: [] as number[],
};

const redisLatency = {
  samples: 0,
  avgMs: 0,
  maxMs: 0,
};

const kafkaLag = {
  samples: 0,
  avgMs: 0,
  maxMs: 0,
};

const memoryUsage = {
  heapUsedMb: 0,
  rssMb: 0,
  samples: 0,
};

function ensureLatencyBucket(key: string): LatencyBucket {
  if (!apiLatency[key]) {
    apiLatency[key] = { count: 0, totalMs: 0, maxMs: 0 };
  }
  return apiLatency[key];
}

function ensureCacheBucket(name: string): CacheBucket {
  if (!cacheStats[name]) {
    cacheStats[name] = { hits: 0, misses: 0 };
  }
  return cacheStats[name];
}

export function recordApiLatency(routeKey: string, durationMs: number): void {
  const bucket = ensureLatencyBucket(routeKey);
  bucket.count += 1;
  bucket.totalMs += durationMs;
  bucket.maxMs = Math.max(bucket.maxMs, durationMs);
}

export function recordCacheResult(cacheName: string, hit: boolean): void {
  const bucket = ensureCacheBucket(cacheName);
  if (hit) {
    bucket.hits += 1;
  } else {
    bucket.misses += 1;
  }
}

export function recordQueueLatency(queueName: string, latencyMs: number): void {
  const current = queueStats[queueName] ?? { samples: 0, avgLatencyMs: 0, maxLatencyMs: 0 };
  const samples = current.samples + 1;
  const avgLatencyMs = ((current.avgLatencyMs * current.samples) + latencyMs) / samples;
  queueStats[queueName] = {
    samples,
    avgLatencyMs,
    maxLatencyMs: Math.max(current.maxLatencyMs, latencyMs),
  };
}

export function recordSymbolIconResult(isFallback: boolean): void {
  if (isFallback) {
    iconQuality.fallbackIcons += 1;
    return;
  }
  iconQuality.realIcons += 1;
}

export function recordSymbolSearchLatency(durationMs: number): void {
  symbolSearchLatency.samples += 1;
  symbolSearchLatency.totalMs += durationMs;
  symbolSearchLatency.p50Window.push(durationMs);
  if (symbolSearchLatency.p50Window.length > 200) {
    symbolSearchLatency.p50Window.shift();
  }
}

export function recordRedisLatency(durationMs: number): void {
  const ms = Math.max(0, durationMs);
  const nextSamples = redisLatency.samples + 1;
  redisLatency.avgMs = ((redisLatency.avgMs * redisLatency.samples) + ms) / nextSamples;
  redisLatency.maxMs = Math.max(redisLatency.maxMs, ms);
  redisLatency.samples = nextSamples;
}

export function recordKafkaLag(lagMsValue: number): void {
  const ms = Math.max(0, lagMsValue);
  const nextSamples = kafkaLag.samples + 1;
  kafkaLag.avgMs = ((kafkaLag.avgMs * kafkaLag.samples) + ms) / nextSamples;
  kafkaLag.maxMs = Math.max(kafkaLag.maxMs, ms);
  kafkaLag.samples = nextSamples;
}

export function recordMemoryUsage(heapUsedMbValue: number, rssMbValue: number): void {
  memoryUsage.heapUsedMb = Number(heapUsedMbValue.toFixed(2));
  memoryUsage.rssMb = Number(rssMbValue.toFixed(2));
  memoryUsage.samples += 1;
}

export function getMetricsSnapshot(): {
  apiLatency: Record<string, { count: number; avgMs: number; maxMs: number }>;
  cacheHitRate: Record<string, { hits: number; misses: number; hitRate: number }>;
  queueLatency: Record<string, { samples: number; avgLatencyMs: number; maxLatencyMs: number }>;
  iconAccuracy: {
    realIconAccuracy: number;
    fallbackUsageRate: number;
    realIcons: number;
    fallbackIcons: number;
  };
  symbolSearch: {
    samples: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
  };
  redisLatency: {
    samples: number;
    avgMs: number;
    maxMs: number;
  };
  kafkaLag: {
    samples: number;
    avgMs: number;
    maxMs: number;
  };
  memory: {
    heapUsedMb: number;
    rssMb: number;
    samples: number;
  };
} {
  const latency = Object.fromEntries(
    Object.entries(apiLatency).map(([key, value]) => ([
      key,
      {
        count: value.count,
        avgMs: value.count ? Number((value.totalMs / value.count).toFixed(2)) : 0,
        maxMs: value.maxMs,
      },
    ])),
  );

  const cache = Object.fromEntries(
    Object.entries(cacheStats).map(([name, value]) => {
      const total = value.hits + value.misses;
      const hitRate = total ? Number(((value.hits / total) * 100).toFixed(2)) : 0;
      return [name, { ...value, hitRate }];
    }),
  );

  const totalIconSamples = iconQuality.realIcons + iconQuality.fallbackIcons;
  const realIconAccuracy = totalIconSamples
    ? Number(((iconQuality.realIcons / totalIconSamples) * 100).toFixed(2))
    : 0;
  const fallbackUsageRate = totalIconSamples
    ? Number(((iconQuality.fallbackIcons / totalIconSamples) * 100).toFixed(2))
    : 0;

  const sortedP50 = [...symbolSearchLatency.p50Window].sort((a, b) => a - b);
  const p50LatencyMs = sortedP50.length
    ? sortedP50[Math.floor(sortedP50.length * 0.5)]
    : 0;

  return {
    apiLatency: latency,
    cacheHitRate: cache,
    queueLatency: queueStats,
    iconAccuracy: {
      realIconAccuracy,
      fallbackUsageRate,
      realIcons: iconQuality.realIcons,
      fallbackIcons: iconQuality.fallbackIcons,
    },
    symbolSearch: {
      samples: symbolSearchLatency.samples,
      avgLatencyMs: symbolSearchLatency.samples
        ? Number((symbolSearchLatency.totalMs / symbolSearchLatency.samples).toFixed(2))
        : 0,
      p50LatencyMs: Number(p50LatencyMs.toFixed(2)),
    },
    redisLatency: {
      samples: redisLatency.samples,
      avgMs: Number(redisLatency.avgMs.toFixed(2)),
      maxMs: Number(redisLatency.maxMs.toFixed(2)),
    },
    kafkaLag: {
      samples: kafkaLag.samples,
      avgMs: Number(kafkaLag.avgMs.toFixed(2)),
      maxMs: Number(kafkaLag.maxMs.toFixed(2)),
    },
    memory: {
      heapUsedMb: memoryUsage.heapUsedMb,
      rssMb: memoryUsage.rssMb,
      samples: memoryUsage.samples,
    },
  };
}

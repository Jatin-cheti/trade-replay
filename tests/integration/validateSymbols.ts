type SymbolItem = {
  symbol?: string;
  fullSymbol?: string;
  name?: string;
  iconUrl?: string | null;
  logoUrl?: string | null;
};

type SearchPayload = {
  items?: SymbolItem[];
  assets?: SymbolItem[];
  hasMore?: boolean;
  nextCursor?: string | null;
};

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000/api";
const TARGET = Number(process.env.SYMBOL_TARGET ?? "500");
const PAGE_LIMIT = 100;

const QUERIES = [
  "A",
  "RE",
  "IN",
  "US",
  "BTC",
  "BANK",
  "M",
  "S",
  "T",
  "CO",
  "PHARMA",
  "TECH",
  "ENERGY",
  "NSE",
  "NYSE",
  ...Array.from({ length: 20 }, () => Math.random().toString(36).slice(2, 4).toUpperCase()),
];

function toUniqueKey(item: SymbolItem): string {
  return item.fullSymbol || `${item.symbol || "UNKNOWN"}:${item.name || "UNKNOWN"}`;
}

function isMissingOrDefaultIcon(url?: string | null): boolean {
  if (!url || !url.trim()) return true;
  const normalized = url.toLowerCase();
  return normalized.includes("default")
    || normalized.includes("/icons/exchange/")
    || normalized.includes("/icons/category/")
    || normalized.includes("/icons/sector/")
    || normalized.includes("generated");
}

async function registerTempUser(): Promise<string> {
  const email = `logo-validate-${Date.now()}@example.com`;
  const password = "Validate#12345";
  const payload = {
    email,
    password,
    name: "Logo Validator",
  };

  const response = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`REGISTER_FAILED_${response.status}`);
  }

  const data = await response.json() as { token?: string };
  if (!data.token) {
    throw new Error("REGISTER_TOKEN_MISSING");
  }

  return data.token;
}

async function searchQuery(token: string, query: string, bag: Map<string, SymbolItem>): Promise<void> {
  let cursor: string | null = null;
  let safety = 0;

  while (safety < 100 && bag.size < TARGET) {
    const params = new URLSearchParams({
      query,
      limit: String(PAGE_LIMIT),
    });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`${API_BASE}/symbols/search?${params.toString()}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`SEARCH_FAILED_${response.status}_${query}`);
    }

    const data = await response.json() as SearchPayload;
    const items = data.items ?? data.assets ?? [];

    for (const item of items) {
      bag.set(toUniqueKey(item), item);
      if (bag.size >= TARGET) break;
    }

    if (!data.hasMore || !data.nextCursor) break;
    cursor = data.nextCursor;
    safety += 1;
  }
}

async function main(): Promise<void> {
  const token = await registerTempUser();
  const bag = new Map<string, SymbolItem>();

  for (const query of QUERIES) {
    if (bag.size >= TARGET) break;
    await searchQuery(token, query, bag);
  }

  const values = Array.from(bag.values());
  const missing = values.filter((item) => isMissingOrDefaultIcon(item.iconUrl || item.logoUrl));
  const correct = values.length - missing.length;
  const accuracy = values.length === 0 ? 0 : (correct / values.length) * 100;

  const output = {
    total: values.length,
    target: TARGET,
    correctIcons: correct,
    missingIcons: missing.length,
    accuracy: `${accuracy.toFixed(2)}%`,
    failedCases: missing.slice(0, 25).map((item) => ({
      fullSymbol: item.fullSymbol || null,
      symbol: item.symbol || null,
      name: item.name || null,
      iconUrl: item.iconUrl || item.logoUrl || null,
    })),
  };

  console.log(JSON.stringify(output, null, 2));

  if (values.length < TARGET) {
    throw new Error(`TARGET_NOT_REACHED_${values.length}`);
  }

  if (accuracy < 95) {
    throw new Error(`ACCURACY_BELOW_TARGET_${accuracy.toFixed(2)}`);
  }
}

main().catch((error) => {
  console.error("symbol_validation_failed", error instanceof Error ? error.message : String(error));
  process.exit(1);
});

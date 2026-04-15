import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSymbol } from "../../utils/normalizeSymbol";

const DATASET_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data/domainDataset.json");

type DomainDataset = Record<string, string>;
let datasetKeysPreviewLogged = false;
let lastGoodDataset: DomainDataset = {};
let writeQueue: Promise<void> = Promise.resolve();

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function loadDomainDatasetSync(): DomainDataset {
  try {
    const raw = fs.readFileSync(DATASET_PATH, "utf-8");
    const rawDataset = JSON.parse(raw) as DomainDataset;
    const normalizedDataset: DomainDataset = {};
    for (const [key, domain] of Object.entries(rawDataset)) {
      const normalizedKey = normalizeSymbol(key);
      if (!normalizedKey) continue;
      normalizedDataset[normalizedKey] = domain;
    }
    if (!datasetKeysPreviewLogged) {
      datasetKeysPreviewLogged = true;
      console.log(Object.keys(normalizedDataset).slice(0, 50));
    }
    lastGoodDataset = normalizedDataset;
    return normalizedDataset;
  } catch (error) {
    if (Object.keys(lastGoodDataset).length > 0) {
      console.log("DATASET LOAD FALLBACK: using last good snapshot");
      return lastGoodDataset;
    }
    console.log("DATASET LOAD ERROR:", error instanceof Error ? error.message : String(error));
    return {};
  }
}

function findClosestKeys(normalized: string, dataset: DomainDataset): string[] {
  if (!normalized) return [];
  const keys = Object.keys(dataset);
  const matches: string[] = [];
  for (const key of keys) {
    if (key.startsWith(normalized) || normalized.startsWith(key)) {
      matches.push(key);
      if (matches.length >= 10) break;
    }
  }
  return matches;
}

async function writeDatasetAtomic(dataset: DomainDataset): Promise<void> {
  const tmpPath = `${DATASET_PATH}.tmp`;
  const payload = `${JSON.stringify(dataset, null, 2)}\n`;
  await fsPromises.writeFile(tmpPath, payload, "utf8");
  await fsPromises.rename(tmpPath, DATASET_PATH);
}

export async function getCuratedDomain(input: { symbol?: string; fullSymbol?: string }): Promise<string | null> {
  const dataset = loadDomainDatasetSync();

  const symbol = input.symbol || input.fullSymbol || "";
  const key = normalizeSymbol(symbol);

  if (!key) return null;

  let domain = dataset[key] || null;

  return domain;
}

export async function saveToDomainDataset(symbol: string, domain: string, confidence = 0): Promise<void> {
  // Only persist high-confidence resolutions to avoid ticker-collision pollution
  if (confidence > 0 && confidence < 0.9) return;
  const normalized = normalizeSymbol(symbol);
  const normalizedDomain = normalizeDomain(domain);
  if (!normalized || !normalizedDomain) return;

  writeQueue = writeQueue.then(async () => {
    const dataset = loadDomainDatasetSync();
    if (dataset[normalized] === normalizedDomain) return;

    dataset[normalized] = normalizedDomain;
    lastGoodDataset = dataset;

    await fsPromises.mkdir(path.dirname(DATASET_PATH), { recursive: true });
    await writeDatasetAtomic(dataset);
  }).catch((error) => {
    console.log("DATASET WRITE ERROR:", error instanceof Error ? error.message : String(error));
  });

  await writeQueue;
}

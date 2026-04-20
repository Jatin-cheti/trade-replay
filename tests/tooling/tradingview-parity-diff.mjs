#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

function parseArgs(argv) {
  const args = {
    maxPixelRatio: 0.06,
    maxAvgChannelDelta: 14,
    writeDiffForPass: false,
    oursDir: 'docs/tradingview-parity/ours',
    referenceDir: 'docs/tradingview-parity/tradingview',
    diffsDir: 'docs/tradingview-parity/diffs',
    reportFile: 'docs/tradingview-parity/reports/parity-report.json',
  };

  for (const raw of argv) {
    const [key, value] = raw.split('=');
    if (!value) continue;
    if (key === '--maxPixelRatio') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) args.maxPixelRatio = parsed;
    } else if (key === '--maxAvgChannelDelta') {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed >= 0) args.maxAvgChannelDelta = parsed;
    } else if (key === '--writeDiffForPass') {
      args.writeDiffForPass = value === '1' || value.toLowerCase() === 'true';
    } else if (key === '--oursDir') {
      args.oursDir = value;
    } else if (key === '--referenceDir') {
      args.referenceDir = value;
    } else if (key === '--diffsDir') {
      args.diffsDir = value;
    } else if (key === '--reportFile') {
      args.reportFile = value;
    }
  }

  return args;
}

async function listPngFilesRecursive(rootDir, current = '') {
  const absolute = path.join(rootDir, current);
  const entries = await fs.readdir(absolute, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const nextRelative = path.join(current, entry.name);
    if (entry.isDirectory()) {
      const nested = await listPngFilesRecursive(rootDir, nextRelative);
      files.push(...nested);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.toLowerCase().endsWith('.png')) continue;
    files.push(nextRelative.replace(/\\/g, '/'));
  }

  return files.sort((a, b) => a.localeCompare(b));
}

async function readPng(filePath) {
  const buf = await fs.readFile(filePath);
  return PNG.sync.read(buf);
}

function averageChannelDelta(aData, bData) {
  const length = Math.min(aData.length, bData.length);
  if (length === 0) return 0;
  let total = 0;
  for (let i = 0; i < length; i += 1) {
    total += Math.abs(aData[i] - bData[i]);
  }
  return total / length;
}

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function main() {
  const cfg = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();

  const oursDir = path.resolve(cwd, cfg.oursDir);
  const referenceDir = path.resolve(cwd, cfg.referenceDir);
  const diffsDir = path.resolve(cwd, cfg.diffsDir);
  const reportFile = path.resolve(cwd, cfg.reportFile);

  await fs.mkdir(diffsDir, { recursive: true });
  await ensureParentDir(reportFile);

  const oursFiles = await listPngFilesRecursive(oursDir);
  const referenceFiles = await listPngFilesRecursive(referenceDir);

  const oursSet = new Set(oursFiles);
  const referenceSet = new Set(referenceFiles);

  const shared = oursFiles.filter((file) => referenceSet.has(file));
  const onlyOurs = oursFiles.filter((file) => !referenceSet.has(file));
  const onlyReference = referenceFiles.filter((file) => !oursSet.has(file));

  const imageResults = [];

  for (const relativePath of shared) {
    const oursPath = path.join(oursDir, relativePath);
    const referencePath = path.join(referenceDir, relativePath);

    const oursPng = await readPng(oursPath);
    const referencePng = await readPng(referencePath);

    if (oursPng.width !== referencePng.width || oursPng.height !== referencePng.height) {
      imageResults.push({
        file: relativePath,
        width: oursPng.width,
        height: oursPng.height,
        referenceWidth: referencePng.width,
        referenceHeight: referencePng.height,
        diffPixels: null,
        diffPixelRatio: null,
        avgChannelDelta: null,
        passed: false,
        reason: 'dimension-mismatch',
      });
      continue;
    }

    const diffPng = new PNG({ width: oursPng.width, height: oursPng.height });
    const diffPixels = pixelmatch(
      oursPng.data,
      referencePng.data,
      diffPng.data,
      oursPng.width,
      oursPng.height,
      {
        threshold: 0.12,
        includeAA: false,
      },
    );

    const totalPixels = oursPng.width * oursPng.height;
    const diffPixelRatio = totalPixels > 0 ? diffPixels / totalPixels : 0;
    const avgDelta = averageChannelDelta(oursPng.data, referencePng.data);
    const passed = diffPixelRatio <= cfg.maxPixelRatio && avgDelta <= cfg.maxAvgChannelDelta;

    if (!passed || cfg.writeDiffForPass) {
      const diffPath = path.join(diffsDir, relativePath);
      await ensureParentDir(diffPath);
      await fs.writeFile(diffPath, PNG.sync.write(diffPng));
    }

    imageResults.push({
      file: relativePath,
      width: oursPng.width,
      height: oursPng.height,
      diffPixels,
      diffPixelRatio,
      avgChannelDelta: avgDelta,
      passed,
      reason: null,
    });
  }

  const comparedCount = imageResults.length;
  const passedCount = imageResults.filter((result) => result.passed).length;
  const failed = imageResults.filter((result) => !result.passed);

  const report = {
    generatedAt: new Date().toISOString(),
    config: {
      maxPixelRatio: cfg.maxPixelRatio,
      maxAvgChannelDelta: cfg.maxAvgChannelDelta,
      oursDir: path.relative(cwd, oursDir).replace(/\\/g, '/'),
      referenceDir: path.relative(cwd, referenceDir).replace(/\\/g, '/'),
      diffsDir: path.relative(cwd, diffsDir).replace(/\\/g, '/'),
    },
    summary: {
      comparedCount,
      passedCount,
      failedCount: failed.length,
      unmatchedOursCount: onlyOurs.length,
      unmatchedReferenceCount: onlyReference.length,
      passed: failed.length === 0 && onlyOurs.length === 0 && onlyReference.length === 0,
    },
    unmatched: {
      onlyOurs,
      onlyReference,
    },
    results: imageResults,
  };

  await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

  const reportPathRelative = path.relative(cwd, reportFile).replace(/\\/g, '/');
  console.log(`[parity-diff] Compared ${comparedCount} files. Passed ${passedCount}/${comparedCount}.`);
  if (onlyOurs.length > 0) {
    console.log(`[parity-diff] Missing in reference: ${onlyOurs.length}`);
  }
  if (onlyReference.length > 0) {
    console.log(`[parity-diff] Missing in ours: ${onlyReference.length}`);
  }
  if (failed.length > 0) {
    const top = failed.slice(0, 8);
    for (const row of top) {
      if (row.reason === 'dimension-mismatch') {
        console.log(`[parity-diff] FAIL ${row.file} (dimension mismatch)`);
      } else {
        console.log(
          `[parity-diff] FAIL ${row.file} ratio=${row.diffPixelRatio.toFixed(4)} avgDelta=${row.avgChannelDelta.toFixed(2)}`,
        );
      }
    }
  }
  console.log(`[parity-diff] Report: ${reportPathRelative}`);

  if (!report.summary.passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[parity-diff] fatal', error);
  process.exitCode = 1;
});

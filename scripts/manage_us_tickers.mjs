#!/usr/bin/env node

import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const TICKER_PATTERN = /^[A-Z][A-Z0-9.-]{0,14}$/;

function parseArgs(argv) {
  const [command = "help", ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--apply") options.apply = true;
    else if (token.startsWith("--")) {
      const key = token.slice(2);
      const value = rest[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${token} 값이 필요합니다.`);
      options[key] = value;
      index += 1;
    } else {
      throw new Error(`알 수 없는 인자입니다: ${token}`);
    }
  }
  return { command, options };
}

function normalizeTicker(value) {
  const ticker = String(value || "").trim().toUpperCase();
  if (!TICKER_PATTERN.test(ticker)) {
    throw new Error("US 티커는 영문으로 시작하는 1~15자의 영문·숫자·점·하이픈만 허용합니다.");
  }
  return ticker;
}

function validateRegistry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("tickers.json은 객체여야 합니다.");
  if (!Array.isArray(value.KRX) || !Array.isArray(value.US)) throw new Error("tickers.json에는 KRX와 US 배열이 필요합니다.");
  const us = value.US.map(normalizeTicker);
  if (new Set(us).size !== us.length) throw new Error("US 티커 목록에 중복이 있습니다.");
  return { ...value, KRX: [...value.KRX], US: us.sort() };
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function atomicJsonWrite(path, value) {
  const temporary = resolve(dirname(path), `.${path.split("/").at(-1)}.assettrail-tmp`);
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  await rename(temporary, path);
}

function usage() {
  return [
    "US 가격 대상 검토 도구",
    "",
    "  node scripts/manage_us_tickers.mjs review --ticker MSFT [--file tickers.json]",
    "  node scripts/manage_us_tickers.mjs add --ticker MSFT --reason \"보유 종목 가격 확인\" --apply",
    "",
    "add는 --apply 없이는 파일을 바꾸지 않습니다. 네트워크 조회나 브라우저 보유정보 전송도 하지 않습니다."
  ].join("\n");
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (["help", "--help", "-h"].includes(command)) {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (!["review", "add"].includes(command)) throw new Error(`지원하지 않는 명령입니다: ${command}`);
  const ticker = normalizeTicker(options.ticker);
  const file = resolve(options.file || "tickers.json");
  const registry = validateRegistry(await readJson(file));
  const exists = registry.US.includes(ticker);
  const result = {
    command,
    ticker,
    file,
    exists,
    changed: false,
    review: {
      requiresRepositoryReview: true,
      priceSource: "yfinance via GitHub Actions",
      browserPortfolioDataUsed: false
    }
  };
  if (command === "review" || exists) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  const reason = String(options.reason || "").trim();
  if (!reason || reason.length > 300) throw new Error("add에는 1~300자의 --reason이 필요합니다.");
  result.reason = reason;
  result.preview = [...registry.US, ticker].sort();
  if (options.apply) {
    await atomicJsonWrite(file, { ...registry, US: result.preview });
    result.changed = true;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.message || "US 티커 검토에 실패했습니다."}\n`);
  process.exitCode = 1;
});

/**
 * Spread Operator Engine for Symbol Search
 *
 * Supports TradingView-style spread syntax:
 *   AAPL/MSFT          → ratio (price A / price B)
 *   AAPL-MSFT          → difference (price A - price B)
 *   AAPL+MSFT          → sum (price A + price B)
 *   AAPL*2             → multiply by scalar
 *   1/AAPL             → inverse of price
 *   BTC+ETH-SOL        → compound expressions
 *   AAPL/MSFT*GOOGL    → chained operations
 */

export type SpreadOperator = "+" | "-" | "*" | "/";

export interface SpreadToken {
  type: "symbol" | "number" | "operator" | "open_paren" | "close_paren";
  value: string;
}

export interface SpreadLeg {
  symbol: string;
  weight: number;
}

export interface SpreadExpression {
  type: "spread";
  raw: string;
  legs: SpreadLeg[];
  operator: SpreadOperator;
  displayLabel: string;
}

export interface SingleSymbol {
  type: "single";
  raw: string;
  symbol: string;
}

export type ParsedQuery = SpreadExpression | SingleSymbol;

const OPERATOR_CHARS = new Set(["+", "-", "*", "/"]);

/**
 * Tokenize a spread expression string into tokens.
 */
export function tokenize(input: string): SpreadToken[] {
  const tokens: SpreadToken[] = [];
  let i = 0;
  const s = input.trim();

  while (i < s.length) {
    // Skip whitespace
    if (s[i] === " " || s[i] === "\t") {
      i++;
      continue;
    }

    // Parentheses
    if (s[i] === "(") {
      tokens.push({ type: "open_paren", value: "(" });
      i++;
      continue;
    }
    if (s[i] === ")") {
      tokens.push({ type: "close_paren", value: ")" });
      i++;
      continue;
    }

    // Operators
    if (OPERATOR_CHARS.has(s[i])) {
      // Handle negative numbers: minus at start or after operator/open_paren
      if (
        s[i] === "-" &&
        (tokens.length === 0 ||
          tokens[tokens.length - 1].type === "operator" ||
          tokens[tokens.length - 1].type === "open_paren")
      ) {
        // Negative number
        let num = "-";
        i++;
        while (i < s.length && (isDigit(s[i]) || s[i] === ".")) {
          num += s[i];
          i++;
        }
        if (num.length > 1) {
          tokens.push({ type: "number", value: num });
          continue;
        }
        // Just a minus sign with no number — treat as operator
        tokens.push({ type: "operator", value: "-" });
        continue;
      }

      tokens.push({ type: "operator", value: s[i] });
      i++;
      continue;
    }

    // Numbers (integers and decimals)
    if (isDigit(s[i])) {
      let num = "";
      while (i < s.length && (isDigit(s[i]) || s[i] === ".")) {
        num += s[i];
        i++;
      }
      // If followed by a letter, it's a symbol starting with digits (e.g., "6E" for Euro FX futures)
      if (i < s.length && isSymbolChar(s[i])) {
        let sym = num;
        while (i < s.length && isSymbolChar(s[i])) {
          sym += s[i];
          i++;
        }
        tokens.push({ type: "symbol", value: sym.toUpperCase() });
        continue;
      }
      tokens.push({ type: "number", value: num });
      continue;
    }

    // Symbols (letters, digits, dots, underscores, colons for exchange prefix)
    if (isSymbolChar(s[i])) {
      let sym = "";
      while (i < s.length && isSymbolChar(s[i])) {
        sym += s[i];
        i++;
      }
      tokens.push({ type: "symbol", value: sym.toUpperCase() });
      continue;
    }

    // Unknown character — skip
    i++;
  }

  return tokens;
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

function isSymbolChar(c: string): boolean {
  return (
    (c >= "A" && c <= "Z") ||
    (c >= "a" && c <= "z") ||
    (c >= "0" && c <= "9") ||
    c === "." ||
    c === "_" ||
    c === ":" ||
    c === "-"
  );
}

/**
 * Detect if a query string is a spread expression (contains operator between symbols).
 */
export function isSpreadExpression(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;

  const tokens = tokenize(trimmed);
  if (tokens.length < 3) return false;

  // Must have at least one operator between two symbols/numbers
  let hasSymbol = false;
  let hasOperator = false;
  let hasSymbolAfterOperator = false;

  for (const token of tokens) {
    if (token.type === "symbol" || token.type === "number") {
      if (hasOperator) hasSymbolAfterOperator = true;
      hasSymbol = true;
    }
    if (token.type === "operator" && hasSymbol) {
      hasOperator = true;
    }
  }

  return hasSymbol && hasOperator && hasSymbolAfterOperator;
}

/**
 * Parse a query into either a single symbol lookup or a spread expression.
 */
export function parseQuery(query: string): ParsedQuery {
  const trimmed = query.trim();

  if (!isSpreadExpression(trimmed)) {
    return { type: "single", raw: trimmed, symbol: trimmed.toUpperCase() };
  }

  const tokens = tokenize(trimmed);
  const legs: SpreadLeg[] = [];
  let primaryOperator: SpreadOperator = "/";
  let foundOperator = false;

  let currentWeight = 1;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === "symbol") {
      legs.push({ symbol: token.value, weight: currentWeight });
      currentWeight = 1;
    } else if (token.type === "number") {
      // Number can be a scalar multiplier
      const nextToken = tokens[i + 1];
      if (nextToken?.type === "operator" && nextToken.value === "*") {
        // number * symbol pattern
        currentWeight = parseFloat(token.value);
        i++; // skip the * operator
      } else if (legs.length > 0) {
        // symbol * number pattern (handled below when we see operator)
        // Just keep it as a standalone number leg
        legs.push({ symbol: token.value, weight: currentWeight });
        currentWeight = 1;
      } else {
        // Leading number (e.g., "1/AAPL")
        legs.push({ symbol: token.value, weight: currentWeight });
        currentWeight = 1;
      }
    } else if (token.type === "operator") {
      if (!foundOperator) {
        primaryOperator = token.value as SpreadOperator;
        foundOperator = true;
      }

      // Adjust weight for next leg based on operator
      if (token.value === "-") {
        currentWeight = -1;
      } else if (token.value === "/") {
        currentWeight = -1; // denominator
      } else {
        currentWeight = 1;
      }
    }
  }

  const symbolLegs = legs.filter((leg) => !isFiniteNumber(leg.symbol));

  const displayLabel = symbolLegs
    .map((leg, index) => {
      if (index === 0) return leg.symbol;
      const op = leg.weight < 0 ? (primaryOperator === "/" ? "/" : "-") : "+";
      return `${op}${leg.symbol}`;
    })
    .join("");

  return {
    type: "spread",
    raw: trimmed,
    legs,
    operator: primaryOperator,
    displayLabel: displayLabel || trimmed,
  };
}

function isFiniteNumber(value: string): boolean {
  return Number.isFinite(parseFloat(value)) && /^-?\d+(\.\d+)?$/.test(value);
}

/**
 * Extract all unique symbol names from a parsed spread expression.
 * Useful for fetching price data for each leg.
 */
export function extractSymbols(parsed: ParsedQuery): string[] {
  if (parsed.type === "single") return [parsed.symbol];

  return [
    ...new Set(
      parsed.legs
        .map((leg) => leg.symbol)
        .filter((sym) => !isFiniteNumber(sym)),
    ),
  ];
}

/**
 * Compute the spread value given prices for each symbol.
 */
export function computeSpreadValue(
  parsed: SpreadExpression,
  prices: Record<string, number>,
): number | null {
  const symbols = extractSymbols(parsed);

  // Check all symbols have prices
  for (const sym of symbols) {
    if (typeof prices[sym] !== "number" || !Number.isFinite(prices[sym])) {
      return null;
    }
  }

  // Simple two-leg computation
  if (parsed.legs.length === 2) {
    const a = resolveValue(parsed.legs[0], prices);
    const b = resolveValue(parsed.legs[1], prices);

    if (a === null || b === null) return null;

    switch (parsed.operator) {
      case "+":
        return a + b;
      case "-":
        return a - b;
      case "*":
        return a * b;
      case "/":
        return b === 0 ? null : a / b;
    }
  }

  // Multi-leg: sum with weights
  let result = 0;
  for (const leg of parsed.legs) {
    const val = resolveValue(leg, prices);
    if (val === null) return null;
    result += val * leg.weight;
  }

  return result;
}

function resolveValue(
  leg: SpreadLeg,
  prices: Record<string, number>,
): number | null {
  const numericValue = parseFloat(leg.symbol);
  if (Number.isFinite(numericValue)) return numericValue;

  const price = prices[leg.symbol];
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return price;
}

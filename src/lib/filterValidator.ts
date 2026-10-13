/**
 * Port of FilterValidator.CanDataSatisfyFilter from C#.
 *
 * Evaluates an OData filter expression against action attribute data.
 * Missing attributes are assumed to evaluate to true (optimistic).
 *
 * Returns { result, isOptimistic } where isOptimistic is true when the
 * result was assumed true due to missing/unknown data.
 */

export interface FilterResult {
  result: boolean;
  isOptimistic: boolean;
}

const functionRegex = /(?<func>contains|endswith|startswith)\(\s*(?<left>[0-9a-zA-Z_]+)\s*,\s*'(?<right>.*)'\s*\)/gi;
const operationRegex =
  /(?<left>[0-9a-zA-Z_]*)\s+(?<op>eq|gt|lt|ge|le|ne)\s+(?<right>@{.*}|null|true|false|[0-9a-zA-Z-]{36}|[0-9]*|`.*`)/gi;

function replaceAll(str: string, search: string, replacement: string): string {
  let result = str;
  let idx = result.toLowerCase().indexOf(search.toLowerCase());
  while (idx !== -1) {
    result = result.substring(0, idx) + replacement + result.substring(idx + search.length);
    idx = result.toLowerCase().indexOf(search.toLowerCase(), idx + replacement.length);
  }
  return result;
}

function execAll(regex: RegExp, str: string): RegExpExecArray[] {
  const r = new RegExp(regex.source, regex.flags);
  const results: RegExpExecArray[] = [];
  let m: RegExpExecArray | null;
  while ((m = r.exec(str)) !== null) results.push(m);
  return results;
}

// Sentinel value injected when an evaluation was optimistic
const OPTIMISTIC_TRUE = "optimistic_true";

export function canDataSatisfyFilter(odataFilter: string | undefined, actionData: Record<string, unknown>): FilterResult {
  if (!odataFilter || odataFilter.trim() === "" || !actionData || Object.keys(actionData).length === 0) {
    return { result: true, isOptimistic: true };
  }

  let filter = odataFilter.replace(/[\r\n]+/g, " ").trim();

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(actionData)) {
    data[k.toLowerCase()] = v;
  }

  let hasOptimistic = false;

  // 1. Evaluate functions (contains, startswith, endswith)
  for (const match of execAll(functionRegex, filter)) {
    const { value, isOptimistic } = evaluateFunction(data, match);
    if (isOptimistic) hasOptimistic = true;
    filter = replaceAll(filter, match[0], isOptimistic ? OPTIMISTIC_TRUE : String(value).toLowerCase());
  }

  // 2. Evaluate operations (eq, ne, gt, lt, ge, le)
  for (const match of execAll(operationRegex, filter)) {
    const { value, isOptimistic } = evaluateOperation(data, match);
    if (isOptimistic) hasOptimistic = true;
    filter = replaceAll(filter, match[0], isOptimistic ? OPTIMISTIC_TRUE : String(value).toLowerCase());
  }

  // 3. Resolve boolean logic with optimistic tracking
  const resolved = evaluateBooleanExpression(filter);

  if (resolved.includes(OPTIMISTIC_TRUE)) hasOptimistic = true;
  const finalFilter = resolved.replace(new RegExp(OPTIMISTIC_TRUE, "gi"), "true");

  const finalResult = evaluateBooleanExpression(finalFilter).trim().toLowerCase() === "true";

  return { result: finalResult, isOptimistic: hasOptimistic && finalResult };
}

const MAX_ITERATIONS = 200;

function evaluateBooleanExpression(expr: string): string {
  let filter = expr;
  let iterations = 0;

  while (iterations++ < MAX_ITERATIONS) {
    const prev = filter;

    filter = filter.replace(/\(\s*(true|false|optimistic_true)\s*\)/gi, (_m, val) => val.toLowerCase());

    filter = filter.replace(/not\s+(true|false|optimistic_true)/i, (_m, val) => {
      if (val.toLowerCase() === OPTIMISTIC_TRUE) return "false";
      return val.toLowerCase() === "true" ? "false" : "true";
    });

    filter = filter.replace(/(true|false|optimistic_true)\s+and\s+(true|false|optimistic_true)/i, (_m, l, r) => {
      const lv = l.toLowerCase();
      const rv = r.toLowerCase();
      if (lv === "false" || rv === "false") return "false";
      if (lv === OPTIMISTIC_TRUE || rv === OPTIMISTIC_TRUE) return OPTIMISTIC_TRUE;
      return lv === "true" && rv === "true" ? "true" : "false";
    });

    filter = filter.replace(/(true|false|optimistic_true)\s+or\s+(true|false|optimistic_true)/i, (_m, l, r) => {
      const lv = l.toLowerCase();
      const rv = r.toLowerCase();
      if (lv === "true" || rv === "true") return "true";
      if (lv === OPTIMISTIC_TRUE || rv === OPTIMISTIC_TRUE) return OPTIMISTIC_TRUE;
      return "false";
    });

    if (filter === prev) break;
  }

  return filter;
}

interface EvalResult {
  value: boolean;
  isOptimistic: boolean;
}

function evaluateFunction(actionData: Record<string, unknown>, match: RegExpExecArray): EvalResult {
  const func = match.groups?.func?.toLowerCase() ?? "";
  const left = match.groups?.left?.toLowerCase() ?? "";
  const right = match.groups?.right ?? "";

  if (!Object.keys(actionData).includes(left)) return { value: true, isOptimistic: true };
  const value = actionData[left];
  if (typeof value === "string" && value.startsWith("@")) return { value: true, isOptimistic: true };

  const valueStr = String(value);
  switch (func) {
    case "contains":
      return { value: valueStr.toLowerCase().includes(right.toLowerCase()), isOptimistic: false };
    case "startswith":
      return { value: valueStr.toLowerCase().startsWith(right.toLowerCase()), isOptimistic: false };
    case "endswith":
      return { value: valueStr.toLowerCase().endsWith(right.toLowerCase()), isOptimistic: false };
    default:
      return { value: true, isOptimistic: true };
  }
}

function evaluateOperation(actionData: Record<string, unknown>, match: RegExpExecArray): EvalResult {
  let left = match.groups?.left?.toLowerCase() ?? "";
  const op = match.groups?.op?.toLowerCase() ?? "";
  let right = match.groups?.right ?? "";

  if (left.startsWith("_") && left.endsWith("_value")) left = left.slice(1, -6);

  if (!Object.keys(actionData).includes(left)) return { value: true, isOptimistic: true };
  const value = actionData[left];

  if (right.startsWith("@{") && right.endsWith("}")) return { value: true, isOptimistic: true };

  if (right.toLowerCase() === "null") {
    if (op === "eq") return { value: value === null || value === undefined, isOptimistic: false };
    if (op === "ne") return { value: value !== null && value !== undefined, isOptimistic: false };
    return { value: true, isOptimistic: true };
  }

  if (right.toLowerCase() === "true" || right.toLowerCase() === "false") {
    if (typeof value !== "boolean") return { value: true, isOptimistic: true };
    const rightBool = right.toLowerCase() === "true";
    if (op === "eq") return { value: value === rightBool, isOptimistic: false };
    if (op === "ne") return { value: value !== rightBool, isOptimistic: false };
    return { value: true, isOptimistic: true };
  }

  if (right.startsWith("'") && right.endsWith("'")) {
    right = right.slice(1, -1);
    if (op === "eq") return { value: String(value).toLowerCase() === right.toLowerCase(), isOptimistic: false };
    if (op === "ne") return { value: String(value).toLowerCase() !== right.toLowerCase(), isOptimistic: false };
    return { value: true, isOptimistic: true };
  }

  const rightNum = Number(right);
  if (!isNaN(rightNum) && right.trim() !== "") {
    const valueNum = Number(value);
    if (!isNaN(valueNum)) {
      switch (op) {
        case "eq": return { value: valueNum === rightNum, isOptimistic: false };
        case "ne": return { value: valueNum !== rightNum, isOptimistic: false };
        case "gt": return { value: valueNum > rightNum, isOptimistic: false };
        case "lt": return { value: valueNum < rightNum, isOptimistic: false };
        case "ge": return { value: valueNum >= rightNum, isOptimistic: false };
        case "le": return { value: valueNum <= rightNum, isOptimistic: false };
        default: return { value: true, isOptimistic: true };
      }
    }
    return { value: true, isOptimistic: true };
  }

  if (/^[0-9a-f-]{36}$/i.test(right)) {
    let valueStr = String(value);
    const guidInParens = valueStr.match(/\(([0-9a-f-]{36})\)/i);
    if (guidInParens) valueStr = guidInParens[1];
    if (op === "eq") return { value: valueStr.toLowerCase() === right.toLowerCase(), isOptimistic: false };
    if (op === "ne") return { value: valueStr.toLowerCase() !== right.toLowerCase(), isOptimistic: false };
    return { value: true, isOptimistic: true };
  }

  return { value: true, isOptimistic: true };
}

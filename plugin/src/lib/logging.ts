const LOG_PREFIX = "[getintro.cc][background]";
const SECRET_FIELD_REGEX = /(api[-_]?key|token|authorization|secret|password)/i;
const MAX_STRING_LENGTH = 4_000;
const MAX_ARRAY_ITEMS = 25;
const MAX_OBJECT_KEYS = 40;

const truncateString = (value: string): string => {
  if (value.length <= MAX_STRING_LENGTH) {
    return value;
  }

  const hiddenChars = value.length - MAX_STRING_LENGTH;
  return `${value.slice(0, MAX_STRING_LENGTH)}… [truncated ${hiddenChars} chars]`;
};

export const previewText = (value: string, maxLength = 500): string => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}… [truncated ${value.length - maxLength} chars]`;
};

export const maskSecret = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  return `[redacted length=${value.length}]`;
};

const sanitizeForLog = (
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown => {
  if (value == null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeForLog(item, depth + 1, seen));

    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[+${value.length - MAX_ARRAY_ITEMS} more items]`);
    }

    return items;
  }

  if (typeof value === "object") {
    if (seen.has(value)) {
      return "[circular]";
    }

    if (depth > 4) {
      return "[max depth reached]";
    }

    seen.add(value);
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    const output: Record<string, unknown> = {};

    for (const key of keys.slice(0, MAX_OBJECT_KEYS)) {
      if (SECRET_FIELD_REGEX.test(key)) {
        const raw = record[key];
        output[key] =
          typeof raw === "string" ? maskSecret(raw) : "[redacted non-string value]";
        continue;
      }

      output[key] = sanitizeForLog(record[key], depth + 1, seen);
    }

    if (keys.length > MAX_OBJECT_KEYS) {
      output.__truncatedKeys = keys.length - MAX_OBJECT_KEYS;
    }

    return output;
  }

  return String(value);
};

export const logInfo = (scope: string, message: string, payload?: unknown): void => {
  const prefix = `${LOG_PREFIX}[${scope}] ${message}`;
  if (payload === undefined) {
    console.log(prefix);
    return;
  }

  console.log(prefix, sanitizeForLog(payload));
};

export const logError = (scope: string, message: string, payload?: unknown): void => {
  const prefix = `${LOG_PREFIX}[${scope}] ${message}`;
  if (payload === undefined) {
    console.error(prefix);
    return;
  }

  console.error(prefix, sanitizeForLog(payload));
};

export const elapsedMs = (startedAt: number): number => Date.now() - startedAt;


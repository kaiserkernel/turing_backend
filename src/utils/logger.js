const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[process.env.LOG_LEVEL ?? "info"] ?? LEVELS.info;

function emit(level, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`;
  const out = level === "error" ? console.error : console.log;
  meta ? out(line, meta) : out(line);
}

export const logger = {
  error: (message, meta) => emit("error", message, meta),
  warn: (message, meta) => emit("warn", message, meta),
  info: (message, meta) => emit("info", message, meta),
  debug: (message, meta) => emit("debug", message, meta)
};

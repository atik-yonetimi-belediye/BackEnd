function serializeError(error) {
  if (!error) return undefined;
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    ...(process.env.NODE_ENV !== "production" && error.stack ? { stack: error.stack } : {}),
  };
}

function write(level, message, fields = {}) {
  const entry = {
    ...fields,
    timestamp: new Date().toISOString(),
    level,
    message,
  };
  if (entry.error instanceof Error) entry.error = serializeError(entry.error);
  const output = JSON.stringify(entry);
  if (level === "error") process.stderr.write(`${output}\n`);
  else process.stdout.write(`${output}\n`);
}

module.exports = {
  info: (message, fields) => write("info", message, fields),
  warn: (message, fields) => write("warn", message, fields),
  error: (message, fields) => write("error", message, fields),
};

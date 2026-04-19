function serializeError(error) {
  if (!error) return undefined;
  return {
    message: error.message || String(error),
    stack: error.stack,
    name: error.name,
  };
}

export function logEvent(level, payload = {}) {
  const event = {
    level,
    time: new Date().toISOString(),
    ...payload,
  };
  if (event.error instanceof Error) {
    event.error = serializeError(event.error);
  }
  const line = JSON.stringify(event);
  if (level === 'error') {
    console.error(line);
    return;
  }
  console.log(line);
}

export function logInfo(payload) {
  logEvent('info', payload);
}

export function logWarn(payload) {
  logEvent('warn', payload);
}

export function logError(payload) {
  logEvent('error', payload);
}

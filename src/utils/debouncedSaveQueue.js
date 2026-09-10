// Keep writes for each record in order, including writes flushed on unmount.
export const createDebouncedSaveQueue = ({ save, onError, delay = 500 }) => {
  const entries = new Map();

  const flushEntry = (key, entry) => {
    clearTimeout(entry.timer);
    entry.timer = null;
    if (entry.pending === null) return entry.chain;

    const payload = entry.pending;
    entry.pending = null;
    const write = entry.chain
      .then(() => save(payload))
      .catch(onError);
    entry.chain = write;
    write.finally(() => {
      if (entries.get(key) === entry && entry.chain === write && entry.pending === null) {
        entries.delete(key);
      }
    });
    return write;
  };

  return {
    schedule(key, payload) {
      let entry = entries.get(key);
      if (!entry) {
        entry = { timer: null, pending: null, chain: Promise.resolve() };
        entries.set(key, entry);
      }
      clearTimeout(entry.timer);
      entry.pending = payload;
      entry.timer = setTimeout(() => flushEntry(key, entry), delay);
    },
    flush() {
      return Promise.all([...entries].map(([key, entry]) => flushEntry(key, entry)));
    },
  };
};

import { feedbackPolicy, feedbackQueueDays, validateFeedback } from '../../lib/feedback.js';

export type FeedbackPayload = {
  id: string;
  token: string;
  policy: string;
  consent: boolean;
  contentConsent: boolean;
  createdAt: number;
  kind: string;
  level: string;
  correction: string;
  expectedLevel: string | null;
  tags: string[];
  excerpt: string;
};
type Entry = {
  id: string;
  token: string;
  state: 'pending' | 'sent' | 'deleting';
  createdAt: number;
  expiresAt: number;
  retryAt: number;
  attempts: number;
  payload?: FeedbackPayload;
};
type Sealed = { id: string; iv: Uint8Array; data: ArrayBuffer };
const day = 86400000;
const changed = () => window.dispatchEvent(new Event('surfare-feedback-change'));
let database: Promise<IDBDatabase> | undefined;
function db() {
  if (!window.isSecureContext || !crypto.subtle || !navigator.locks)
    throw Error('Secure feedback storage is unavailable in this browser.');
  return (database ||= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('surfare-feedback-v1', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('entries', { keyPath: 'id' });
      request.result.createObjectStore('keys');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = undefined;
      reject(Error('Feedback storage could not open.'));
    };
    request.onblocked = () => reject(Error('Close other Surfare tabs to update feedback storage.'));
  }));
}
async function operation<T>(
  store: string,
  mode: IDBTransactionMode,
  action: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(store, mode),
      request = action(tx.objectStore(store));
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = tx.onabort = () => reject(Error('Could not save feedback on this device.'));
  });
}
async function key() {
  let value = await operation<CryptoKey | undefined>('keys', 'readonly', (s) => s.get('local'));
  if (!value) {
    value = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    await operation('keys', 'readwrite', (s) => s.put(value, 'local'));
  }
  return value;
}
async function save(entry: Entry) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await key(),
    new TextEncoder().encode(JSON.stringify(entry)),
  );
  await operation('entries', 'readwrite', (s) => s.put({ id: entry.id, iv, data }));
}
async function remove(id: string) {
  await operation('entries', 'readwrite', (s) => s.delete(id));
}
async function entries(): Promise<Entry[]> {
  const rows = await operation<Sealed[]>('entries', 'readonly', (s) => s.getAll());
  const result: Entry[] = [];
  for (const row of rows) {
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: row.iv as Uint8Array<ArrayBuffer> },
      await key(),
      row.data,
    );
    const entry: Entry = JSON.parse(new TextDecoder().decode(raw));
    if (entry.expiresAt <= Date.now()) await remove(entry.id);
    else result.push(entry);
  }
  return result;
}
function locked<T>(action: () => Promise<T>) {
  if (!navigator.locks)
    return Promise.reject(Error('This browser cannot securely manage feedback.'));
  return navigator.locks.request('surfare-feedback', action);
}
export async function queueFeedback(
  fields: Omit<FeedbackPayload, 'id' | 'token' | 'policy' | 'createdAt'>,
) {
  return locked(async () => {
    const all = await entries();
    if (all.length >= 30) throw Error('Feedback storage is full. Delete an older receipt first.');
    const payload: FeedbackPayload = {
      ...fields,
      policy: feedbackPolicy,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      token: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
    };
    validateFeedback(payload);
    await save({
      id: payload.id,
      token: payload.token,
      payload,
      state: 'pending',
      createdAt: payload.createdAt,
      expiresAt: Date.now() + feedbackQueueDays * day,
      retryAt: 0,
      attempts: 0,
    });
    changed();
    return payload.id;
  });
}
export async function listFeedback() {
  return locked(async () =>
    (await entries()).map(({ id, state, createdAt, expiresAt, payload }) => ({
      id,
      state,
      createdAt,
      expiresAt,
      // Excerpts and deletion secrets never leave storage through the list UI.
      contentIncluded: !!payload?.excerpt,
    })),
  );
}
export async function withdrawFeedback(id: string) {
  await locked(async () => {
    const entry = (await entries()).find((item) => item.id === id);
    if (!entry) return;
    await save({
      ...entry,
      payload: undefined,
      state: 'deleting',
      retryAt: 0,
      attempts: 0,
      expiresAt: Date.now() + 37 * day,
    });
    changed();
  });
  return flushFeedback();
}
export async function clearLocalFeedback() {
  await locked(async () => {
    await operation('entries', 'readwrite', (s) => s.clear());
    changed();
  });
}
export async function flushFeedback() {
  if (!navigator.onLine) return 'Offline. Approved feedback waits on this device.';
  return locked(async () => {
    let message = '';
    const pending = (await entries()).sort(
      (a, b) => Number(b.state === 'deleting') - Number(a.state === 'deleting'),
    );
    for (const entry of pending) {
      if (entry.state === 'sent' || entry.retryAt > Date.now()) continue;
      try {
        const response = await fetch('/api/feedback', {
          method: entry.state === 'deleting' ? 'DELETE' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            entry.state === 'deleting' ? { id: entry.id, token: entry.token } : entry.payload,
          ),
          signal: AbortSignal.timeout(15000),
        });
        if (response.status === 409) {
          await remove(entry.id);
          message = 'This submission was withdrawn or its receipt is no longer valid.';
        } else if (!response.ok) {
          entry.attempts++;
          entry.retryAt = Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(entry.attempts, 6));
          await save(entry);
          message =
            response.status === 400
              ? 'A queued submission needs to be deleted and resubmitted with updated consent.'
              : 'Feedback storage is unavailable. Approved submissions remain queued.';
          break;
        } else {
          const acknowledgement = await response.json();
          if (acknowledgement.status !== (entry.state === 'deleting' ? 'deleted' : 'saved'))
            throw Error('Missing feedback acknowledgement.');
          if (entry.state === 'deleting') {
            await remove(entry.id);
            message = 'Feedback content deleted.';
          } else {
            await save({
              ...entry,
              state: 'sent',
              payload: undefined,
              expiresAt: Date.now() + 31 * day,
            });
            message = 'Feedback sent. A deletion receipt is saved on this device.';
          }
        }
      } catch {
        entry.attempts++;
        entry.retryAt = Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(entry.attempts, 6));
        await save(entry);
        message = 'Could not connect. Approved feedback remains queued.';
        break;
      }
    }
    changed();
    return message;
  });
}

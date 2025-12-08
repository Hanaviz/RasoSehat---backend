const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Supabase URL or Service Role Key not set. Check your .env');
}

// Wrap fetch to add a request timeout and clearer error message.
// Supabase client accepts a `fetch` implementation; we use the global fetch
// and add an AbortController-based timeout to avoid long undici timeouts.
const DEFAULT_FETCH_TIMEOUT = parseInt(process.env.SUPABASE_FETCH_TIMEOUT_MS || '20000', 10); // 20s default

function fetchWithTimeout(resource, options = {}) {
  const timeoutMs = options._timeout || DEFAULT_FETCH_TIMEOUT;
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Ensure we don't pass our internal _timeout to the underlying fetch
  const { _timeout, ...fetchOptions } = options;
  fetchOptions.signal = signal;

  return globalThis.fetch(resource, fetchOptions)
    .then((res) => {
      clearTimeout(timer);
      return res;
    })
    .catch((err) => {
      clearTimeout(timer);
      // Normalize abort to a clearer error
      if (err.name === 'AbortError') {
        const e = new Error(`Fetch aborted after ${timeoutMs}ms`);
        e.code = 'ETIMEDOUT';
        throw e;
      }
      throw err;
    });
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  fetch: fetchWithTimeout
});

module.exports = supabase;

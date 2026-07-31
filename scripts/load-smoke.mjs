import { performance } from 'node:perf_hooks';

const baseUrl = (process.env.LOAD_BASE_URL || 'http://127.0.0.1:5001/api').replace(/\/+$/, '');
const users = Number(process.env.LOAD_USERS || 5);
const iterations = Number(process.env.LOAD_ITERATIONS || 5);
const identifier = process.env.LOAD_IDENTIFIER || '05053334455';
const password = process.env.LOAD_PASSWORD || 'sofor123';
const timings = [];
const enableWrites = process.env.LOAD_ENABLE_WRITES === 'true';
const runId = Date.now();
const complaintIds = [];

async function request(path, options = {}) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, options);
  timings.push(performance.now() - started);
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return response;
}

function sessionHeaders(response) {
  const cookies = response.headers.getSetCookie().map((value) => value.split(';')[0]);
  return { cookie: cookies.join('; '), csrf: decodeURIComponent(cookies.find((value) => value.startsWith('csrf_token='))?.slice('csrf_token='.length) || '') };
}

async function virtualUser(userIndex) {
  const login = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier, sifre: password }) });
  const { cookie, csrf } = sessionHeaders(login);
  let container;
  for (let index = 0; index < iterations; index += 1) {
    const tasks = await request('/sofor/konteynerler?limit=20&page=1', { headers: { Cookie: cookie } });
    if (!container) container = (await tasks.json()).data?.[0];
  }
  if (enableWrites && container) {
    await request('/sofor/toplama-kayitlari', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf, 'Idempotency-Key': `load-smoke-${runId}-${userIndex}-000000` , 'Content-Type': 'application/json' }, body: JSON.stringify({ konteyner_id: container.id, durum: 'toplandi' }) });
    const form = new FormData();
    form.set('vatandas_ad_soyad', 'Yük Testi'); form.set('vatandas_telefon', '05059990000'); form.set('konteyner_id', String(container.id)); form.set('sikayet_turu', container.tur); form.set('sikayet_kategorisi', 'diger'); form.set('sikayet_metni', `Yük testi ${runId}`);
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    form.set('fotograflar', new Blob([png], { type: 'image/png' }), 'load-test.png');
    const complaint = await request('/sikayetler', { method: 'POST', body: form });
    complaintIds.push((await complaint.json()).data.id);
  }
}

await Promise.all(Array.from({ length: users }, (_, index) => virtualUser(index)));

if (complaintIds.length) {
  const adminLogin = await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: process.env.LOAD_ADMIN_IDENTIFIER || 'denizk', sifre: process.env.LOAD_ADMIN_PASSWORD || 'admin123' }) });
  const admin = sessionHeaders(adminLogin);
  await Promise.all(complaintIds.map((id) => fetch(`${baseUrl}/sikayetler/${id}`, { method: 'DELETE', headers: { Cookie: admin.cookie, 'X-CSRF-Token': admin.csrf } })));
}
timings.sort((a, b) => a - b);
const percentile = (ratio) => timings[Math.min(timings.length - 1, Math.floor(timings.length * ratio))];
const summary = { requests: timings.length, write_flows: enableWrites ? users : 0, p50_ms: percentile(0.5).toFixed(1), p95_ms: percentile(0.95).toFixed(1), max_ms: timings.at(-1).toFixed(1) };
console.log(JSON.stringify(summary));
if (percentile(0.95) > Number(process.env.LOAD_P95_LIMIT_MS || 1200)) process.exitCode = 1;

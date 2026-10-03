import crypto from 'node:crypto';

const encoder = new TextEncoder();

function truthy(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function config() {
  const endpoint = String(process.env.R2_ENDPOINT || '').trim().replace(/\/$/, '');
  const bucket = String(process.env.R2_BUCKET || '').trim();
  const accessKey = String(process.env.R2_ACCESS_KEY || '').trim();
  const secretKey = String(process.env.R2_SECRET_KEY || '').trim();
  const publicUrl = String(process.env.R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
  const folder = String(process.env.R2_FOLDER || 'trazio-system').trim().replace(/^\/+|\/+$/g, '');
  return { enabled: truthy(process.env.R2_ENABLED), endpoint, bucket, accessKey, secretKey, publicUrl, folder };
}

function encodeRfc3986(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodedPath(pathname) {
  return pathname.split('/').map((part) => encodeRfc3986(part)).join('/');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function signingKey(secret, dateStamp, region = 'auto', service = 's3') {
  const kDate = hmac(Buffer.from(`AWS4${secret}`, 'utf8'), dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function formatAmzDate(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function canonicalQuery(params = {}) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
}

function normalizeHeaderValue(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

async function signedRequest(method, objectKey = '', { query = {}, body = null, headers = {}, allow404 = false } = {}) {
  const cfg = config();
  if (!cfg.enabled) throw Object.assign(new Error('R2 no está habilitado.'), { code: 'R2_DISABLED' });
  const missing = ['endpoint', 'bucket', 'accessKey', 'secretKey'].filter((key) => !cfg[key]);
  if (missing.length) throw new Error(`R2_ENABLED=true requiere configuración completa: ${missing.join(', ')}`);

  const endpoint = new URL(cfg.endpoint);
  const key = String(objectKey || '').replace(/^\/+/, '');
  const pathname = `/${encodeRfc3986(cfg.bucket)}${key ? `/${encodedPath(key)}` : ''}`;
  const queryString = canonicalQuery(query);
  const payload = body == null ? Buffer.alloc(0) : (Buffer.isBuffer(body) ? body : Buffer.from(body));
  const payloadHash = sha256(payload);
  const amzDate = formatAmzDate();
  const dateStamp = amzDate.slice(0, 8);

  const signedHeadersMap = {
    host: endpoint.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...Object.fromEntries(Object.entries(headers).map(([keyName, value]) => [keyName.toLowerCase(), normalizeHeaderValue(value)]))
  };
  const signedHeaderNames = Object.keys(signedHeadersMap).sort();
  const canonicalHeaders = `${signedHeaderNames.map((name) => `${name}:${normalizeHeaderValue(signedHeadersMap[name])}`).join('\n')}\n`;
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalRequest = [method.toUpperCase(), pathname, queryString, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const signature = hmac(signingKey(cfg.secretKey, dateStamp), stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const url = `${endpoint.origin}${pathname}${queryString ? `?${queryString}` : ''}`;
  const response = await fetch(url, {
    method,
    headers: {
      ...headers,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: authorization
    },
    body: ['GET', 'HEAD'].includes(method.toUpperCase()) ? undefined : payload
  });

  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`R2 respondió ${response.status}${detail ? `: ${detail.slice(0, 500)}` : ''}`);
  }
  return response;
}

function xmlDecode(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlTag(xml, tag) {
  const match = String(xml).match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? xmlDecode(match[1]) : null;
}

function fullKey(relativeKey = '') {
  const cfg = config();
  const relative = String(relativeKey || '').replace(/^\/+/, '');
  return [cfg.folder, relative].filter(Boolean).join('/');
}

export function isR2Enabled() {
  return config().enabled;
}

export function validateR2Config() {
  const cfg = config();
  if (!cfg.enabled) return;
  const required = ['endpoint', 'bucket', 'accessKey', 'secretKey', 'publicUrl'];
  const missing = required.filter((key) => !cfg[key]);
  if (missing.length) throw new Error(`R2_ENABLED=true requiere: ${missing.map((key) => `R2_${key.replace(/[A-Z]/g, (letter) => `_${letter}`).toUpperCase()}`).join(', ')}`);
  try { new URL(cfg.endpoint); new URL(cfg.publicUrl); } catch { throw new Error('R2_ENDPOINT y R2_PUBLIC_URL deben ser URLs válidas.'); }
}

export function r2PublicUrl(relativeKey) {
  const cfg = config();
  if (!cfg.publicUrl) return null;
  const key = fullKey(relativeKey);
  return `${cfg.publicUrl}/${key.split('/').map(encodeRfc3986).join('/')}`;
}

export function r2RelativeKeyFromPublicUrl(value) {
  const cfg = config();
  if (!cfg.publicUrl) return null;
  let url;
  try { url = new URL(String(value || '')); } catch { return null; }
  const base = new URL(cfg.publicUrl);
  if (url.origin !== base.origin) return null;
  const basePath = base.pathname.replace(/\/$/, '');
  if (!url.pathname.startsWith(`${basePath}/`)) return null;
  const decoded = url.pathname.slice(basePath.length + 1).split('/').map((part) => decodeURIComponent(part)).join('/');
  const prefix = config().folder ? `${config().folder}/` : '';
  if (prefix && !decoded.startsWith(prefix)) return null;
  return prefix ? decoded.slice(prefix.length) : decoded;
}

export async function putR2Object(relativeKey, body, { contentType = 'application/octet-stream', cacheControl = 'public, max-age=31536000, immutable' } = {}) {
  const key = fullKey(relativeKey);
  await signedRequest('PUT', key, { body, headers: { 'content-type': contentType, 'cache-control': cacheControl } });
  return { key: relativeKey, url: r2PublicUrl(relativeKey) };
}

export async function deleteR2Object(relativeKey) {
  if (!isR2Enabled()) return false;
  await signedRequest('DELETE', fullKey(relativeKey));
  return true;
}

export async function headR2Object(relativeKey) {
  if (!isR2Enabled()) return null;
  const response = await signedRequest('HEAD', fullKey(relativeKey), { allow404: true });
  if (!response) return null;
  return {
    size: Number(response.headers.get('content-length') || 0),
    contentType: response.headers.get('content-type') || null,
    lastModified: response.headers.get('last-modified') || null,
    etag: String(response.headers.get('etag') || '').replace(/^"|"$/g, '') || null
  };
}

export async function getR2Text(relativeKey) {
  if (!isR2Enabled()) return null;
  const response = await signedRequest('GET', fullKey(relativeKey), { allow404: true });
  return response ? response.text() : null;
}

export async function listR2Objects(relativePrefix = '') {
  if (!isR2Enabled()) return [];
  const prefix = fullKey(relativePrefix);
  const rows = [];
  let token = null;

  do {
    const query = { 'list-type': '2', prefix, 'max-keys': '1000' };
    if (token) query['continuation-token'] = token;
    const response = await signedRequest('GET', '', { query });
    const xml = await response.text();
    const contents = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/gi)];
    for (const match of contents) {
      const key = xmlTag(match[1], 'Key');
      if (!key) continue;
      const folderPrefix = config().folder ? `${config().folder}/` : '';
      rows.push({
        key: folderPrefix && key.startsWith(folderPrefix) ? key.slice(folderPrefix.length) : key,
        size: Number(xmlTag(match[1], 'Size') || 0),
        lastModified: xmlTag(match[1], 'LastModified')
      });
    }
    const truncated = String(xmlTag(xml, 'IsTruncated') || '').toLowerCase() === 'true';
    token = truncated ? xmlTag(xml, 'NextContinuationToken') : null;
  } while (token);

  return rows;
}

export async function deleteR2Prefix(relativePrefix = '') {
  if (!isR2Enabled()) return 0;
  const rows = await listR2Objects(relativePrefix);
  for (const row of rows) await deleteR2Object(row.key);
  return rows.length;
}


export async function getR2Object(relativeKey) {
  if (!isR2Enabled()) return null;
  const response = await signedRequest('GET', fullKey(relativeKey), { allow404: true });
  if (!response) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    cacheControl: response.headers.get('cache-control') || null,
    etag: String(response.headers.get('etag') || '').replace(/^"|"$/g, '') || null
  };
}

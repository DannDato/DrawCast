import { OAuth2Client } from 'google-auth-library';

const verifier = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function normalizeOrigin(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function configuredFrontendOrigins() {
  const values = [
    ...(String(process.env.CORS_ORIGINS || '').split(',')),
    process.env.FRONTEND_URL || ''
  ];
  return new Set(values.map(normalizeOrigin).filter(Boolean));
}

function frontendOrigin() {
  return normalizeOrigin(process.env.FRONTEND_URL) || 'http://localhost:5173';
}

export function resolveGooglePopupRedirectUri(requestedRedirectUri) {
  const requestedOrigin = normalizeOrigin(requestedRedirectUri);
  if (!requestedOrigin) return frontendOrigin();

  const allowedOrigins = configuredFrontendOrigins();
  if (!allowedOrigins.size || !allowedOrigins.has(requestedOrigin)) {
    throw new Error(`Origen OAuth de Google no permitido: ${requestedOrigin}`);
  }

  return requestedOrigin;
}

export function googleIdentityConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID);
}

export function googleCodeFlowConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export async function verifyGoogleCredential(credential) {
  if (!googleIdentityConfigured()) throw new Error('Google OAuth no configurado');
  const ticket = await verifier.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email || !payload.email_verified) throw new Error('Identidad de Google inválida');
  return payload;
}

export async function exchangeGoogleCode(code, requestedRedirectUri = null) {
  if (!googleCodeFlowConfigured()) throw new Error('Google OAuth no configurado');
  if (!code) throw new Error('Código de Google requerido');

  const redirectUri = resolveGooglePopupRedirectUri(requestedRedirectUri);
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.id_token) throw new Error('Google no devolvió una identidad válida');
  return verifyGoogleCredential(tokens.id_token);
}

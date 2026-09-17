import { OAuth2Client } from 'google-auth-library';

const verifier = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function frontendOrigin() {
  try {
    return new URL(process.env.FRONTEND_URL || 'http://localhost:5173').origin;
  } catch {
    return 'http://localhost:5173';
  }
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

export async function exchangeGoogleCode(code) {
  if (!googleCodeFlowConfigured()) throw new Error('Google OAuth no configurado');
  if (!code) throw new Error('Código de Google requerido');

  const redirectUri = frontendOrigin();
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri });
  if (!tokens.id_token) throw new Error('Google no devolvió una identidad válida');
  return verifyGoogleCredential(tokens.id_token);
}

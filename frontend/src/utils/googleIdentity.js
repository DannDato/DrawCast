import api from '../api/axios';

const GOOGLE_READY_TIMEOUT_MS = 12000;
const GOOGLE_SCRIPT_ID = 'drawcast-google-identity-script';
const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const STATE_KEY = '__drawcastGoogleCodeState';

const state = globalThis[STATE_KEY] || {
  configPromise: null,
  scriptPromise: null,
  initializedClientId: null,
  codeClient: null,
  activeRequest: null
};
globalThis[STATE_KEY] = state;

export function getGoogleClientId() {
  if (!state.configPromise) {
    state.configPromise = api.get('/auth/google/config')
      .then(({ data }) => data.enabled ? (data.clientId || '') : '')
      .catch((error) => {
        state.configPromise = null;
        throw error;
      });
  }
  return state.configPromise;
}

function loadGoogleScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  if (state.scriptPromise) return state.scriptPromise;

  state.scriptPromise = new Promise((resolve, reject) => {
    const startedAt = Date.now();
    let script = document.getElementById(GOOGLE_SCRIPT_ID);

    const finishWhenReady = () => {
      if (window.google?.accounts?.oauth2) {
        resolve(window.google.accounts.oauth2);
        return;
      }
      if (Date.now() - startedAt >= GOOGLE_READY_TIMEOUT_MS) {
        reject(new Error('Google Identity Services no terminó de cargar.'));
        return;
      }
      window.setTimeout(finishWhenReady, 80);
    };

    if (!script) {
      script = document.createElement('script');
      script.id = GOOGLE_SCRIPT_ID;
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'));
      document.head.appendChild(script);
    }

    if (script.dataset.loaded === 'true') finishWhenReady();
    else {
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true';
        finishWhenReady();
      }, { once: true });
      // Si otro montaje insertó el script y ya terminó antes de registrar este listener.
      finishWhenReady();
    }
  }).catch((error) => {
    state.scriptPromise = null;
    throw error;
  });

  return state.scriptPromise;
}

async function ensureGoogleCodeClient(clientId) {
  if (!clientId) throw new Error('Google OAuth no está configurado.');
  const googleOAuth = await loadGoogleScript();

  if (state.initializedClientId && state.initializedClientId !== clientId) {
    throw new Error('Google OAuth cambió de configuración durante esta sesión. Recarga la página.');
  }

  if (!state.codeClient) {
    state.codeClient = googleOAuth.initCodeClient({
      client_id: clientId,
      scope: 'openid email profile',
      ux_mode: 'popup',
      callback: (response) => {
        const request = state.activeRequest;
        state.activeRequest = null;
        if (!request) return;
        if (response?.error || !response?.code) {
          request.onError?.(response?.error_description || response?.error || 'Google no devolvió un código de acceso.');
          return;
        }
        request.onCode?.(response.code);
      },
      error_callback: (error) => {
        const request = state.activeRequest;
        state.activeRequest = null;
        if (!request) return;
        if (error?.type === 'popup_closed') {
          request.onCancel?.();
          return;
        }
        request.onError?.('No se pudo abrir Google. Intenta de nuevo.');
      }
    });
    state.initializedClientId = clientId;
  }

  return state.codeClient;
}

export async function requestGoogleCode({ onCode, onError, onCancel }) {
  const clientId = await getGoogleClientId();
  const client = await ensureGoogleCodeClient(clientId);
  const token = Symbol('google-code-request');
  state.activeRequest = { token, onCode, onError, onCancel };

  try {
    client.requestCode();
  } catch (error) {
    if (state.activeRequest?.token === token) state.activeRequest = null;
    throw error;
  }

  return () => {
    if (state.activeRequest?.token === token) state.activeRequest = null;
  };
}

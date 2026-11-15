import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWebsiteLockConfig, registerGatewayRoutes } from './server/gateway.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const UPSTREAM_TIMEOUT_MS = 15000;
const RETRY_BACKOFF_MINUTES = [2, 5, 15, 30, 60];

interface ProviderProxyBody {
  action?: 'balance' | 'services' | 'testConnection' | 'add' | 'status';
  format?: string;
  providerId?: string;
  apiUrl?: string;
  apiKey?: string;
  service?: string;
  link?: string;
  quantity?: number;
  order?: string;
  firebaseProjectId?: string;
  firebaseDatabaseId?: string;
}

interface FirebaseAppletConfigFile {
  projectId?: string;
  firestoreDatabaseId?: string;
}

interface FirebaseTarget {
  projectId: string;
  databaseId: string;
}

function loadFirebaseTargetConfig(): FirebaseTarget {
  const cfgPath = path.resolve(__dirname, 'firebase-applet-config.json');
  try {
    if (fs.existsSync(cfgPath)) {
      const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as FirebaseAppletConfigFile;
      if (parsed.projectId) {
        return {
          projectId: parsed.projectId,
          databaseId: parsed.firestoreDatabaseId || '(default)',
        };
      }
    }
  } catch {
    // fallback to env vars if present
  }
  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    databaseId:
      process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || '(default)',
  };
}

function resolveRequestFirebaseTarget(body: unknown): FirebaseTarget {
  const fallback = loadFirebaseTargetConfig();
  if (!body || typeof body !== 'object') return fallback;
  const record = body as Record<string, unknown>;
  const rawProj =
    typeof record.firebaseProjectId === 'string' ? record.firebaseProjectId.trim() : '';
  const rawDb =
    typeof record.firebaseDatabaseId === 'string' ? record.firebaseDatabaseId.trim() : '';

  const validProject = /^[a-z0-9-]{4,80}$/.test(rawProj) ? rawProj : fallback.projectId;
  const validDb =
    rawDb === '(default)' || /^[a-z0-9-]{2,80}$/.test(rawDb) ? rawDb : fallback.databaseId;

  return {
    projectId: validProject,
    databaseId: validDb || '(default)',
  };
}

function parseFirestoreValue(raw: Record<string, unknown> | undefined): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  if ('stringValue' in raw) return String(raw.stringValue);
  if ('integerValue' in raw) return Number(raw.integerValue);
  if ('doubleValue' in raw) return Number(raw.doubleValue);
  if ('booleanValue' in raw) return Boolean(raw.booleanValue);
  if ('timestampValue' in raw) return String(raw.timestampValue);
  if ('nullValue' in raw) return null;
  return undefined;
}

function parseFirestoreDocumentFields(
  docJson: { fields?: Record<string, Record<string, unknown>> } | null
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const fields = docJson?.fields ?? {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

async function fetchFirestoreDocWithToken(
  docPath: string,
  idToken: string,
  targetOverride?: FirebaseTarget
): Promise<Record<string, unknown>> {
  const target = targetOverride ?? loadFirebaseTargetConfig();
  if (!target.projectId) {
    throw new Error('Firebase project configuration is not initialized on server.');
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId
  )}/databases/${encodeURIComponent(target.databaseId)}/documents/${docPath}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Unauthorized: Admin verification required for server-side operation.');
  }
  if (response.status === 404) {
    throw new Error(`Requested document (${docPath}) was not found.`);
  }
  if (!response.ok) {
    throw new Error(`Unable to read Firestore record (${response.status}).`);
  }

  const json = (await response.json()) as { fields?: Record<string, Record<string, unknown>> };
  return parseFirestoreDocumentFields(json);
}

/**
 * Verifies an Admin/Manager Firebase ID token directly against Firestore REST RBAC rules.
 * Firestore rejects non-admin/unauthenticated tokens with 401/403 even if the doc doesn't exist.
 */
async function verifyAdminViaFirestoreRest(
  idToken: string,
  target: FirebaseTarget
): Promise<void> {
  if (!target.projectId) {
    throw new Error('Firebase project configuration is missing.');
  }
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId
  )}/databases/${encodeURIComponent(target.databaseId)}/documents/settings/setup`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Unauthorized: Admin privileges required.');
  }
}

function mapProviderStatusToInternal(
  rawStatus: string
): 'Pending' | 'Processing' | 'In Progress' | 'Completed' | 'Partial' | 'Cancelled' | 'Failed' {
  const lower = rawStatus.trim().toLowerCase();
  if (lower.includes('complete') || lower === 'finish' || lower === 'finished') {
    return 'Completed';
  }
  if (lower.includes('partial')) {
    return 'Partial';
  }
  if (lower.includes('in progress') || lower === 'inprogress') {
    return 'In Progress';
  }
  if (lower.includes('process')) {
    return 'Processing';
  }
  if (lower.includes('cancel') || lower.includes('refund')) {
    return 'Cancelled';
  }
  if (lower.includes('fail') || lower.includes('error')) {
    return 'Failed';
  }
  return 'Pending';
}

function computeNextRetrySchedule(currentRetryCount: number): {
  retryCount: number;
  backoffMinutes: number;
  nextRetryAtMs: number;
} {
  const nextCount = Math.min(20, Math.max(1, currentRetryCount + 1));
  const idx = Math.min(RETRY_BACKOFF_MINUTES.length - 1, nextCount - 1);
  const backoffMinutes = RETRY_BACKOFF_MINUTES[idx];
  return {
    retryCount: nextCount,
    backoffMinutes,
    nextRetryAtMs: Date.now() + backoffMinutes * 60 * 1000,
  };
}

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return '';
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase();
  if (!lower) return true;
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  // Block private IPv4 ranges to avoid SSRF against local/metadata services
  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const [, aStr, bStr] = ipv4Match;
    const a = Number(aStr);
    const b = Number(bStr);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
}

function validateProviderUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid API URL format. Please enter a valid https:// URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('API URL must use https:// or http:// protocol.');
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Private or localhost provider URLs are not allowed.');
  }
  return parsed;
}

function sanitizeErrorMessage(message: string, secretKey: string): string {
  let clean = message || 'Provider API request failed.';
  if (secretKey && secretKey.trim().length > 0) {
    clean = clean.split(secretKey.trim()).join('[REDACTED]');
  }
  return clean.slice(0, 260);
}

async function callUpstreamSmmV2(
  apiUrl: string,
  apiKey: string,
  params: Record<string, string>
): Promise<unknown> {
  const targetUrl = validateProviderUrl(apiUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const body = new URLSearchParams({
      key: apiKey,
      ...params,
    });

    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json, text/plain, */*',
      },
      body: body.toString(),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }

    if (!response.ok) {
      const upstreamMsg =
        parsed && typeof parsed === 'object' && 'error' in parsed
          ? String((parsed as { error: unknown }).error)
          : `Provider returned HTTP ${response.status}.`;
      throw new Error(sanitizeErrorMessage(upstreamMsg, apiKey));
    }

    if (!parsed) {
      throw new Error('Provider returned an unexpected non-JSON response.');
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'error' in parsed &&
      (parsed as { error: unknown }).error
    ) {
      throw new Error(sanitizeErrorMessage(String((parsed as { error: unknown }).error), apiKey));
    }

    return parsed;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Provider API request timed out after 15 seconds.');
    }
    if (err instanceof Error) {
      throw new Error(sanitizeErrorMessage(err.message, apiKey));
    }
    throw new Error('Unable to reach provider API endpoint.');
  } finally {
    clearTimeout(timer);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  registerGatewayRoutes(app, {
    resolveRequestFirebaseTarget,
    extractBearerToken,
    verifyAdminViaFirestoreRest,
    fetchFirestoreDocWithToken,
    callUpstreamSmmV2,
    sanitizeErrorMessage,
    mapProviderStatusToInternal,
  });

  /**
   * Secure server-side order dispatch:
   * Browser passes ONLY { orderId, providerIdOverride? } + Bearer Firebase ID token.
   * Server fetches provider credentials directly from Firestore REST (enforcing Admin RBAC)
   * so API keys are never transmitted from or exposed to the frontend during dispatch.
   */
  app.post('/api/orders/dispatch', async (req: Request, res: Response) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Authentication token required.' });
      return;
    }

    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    const providerIdOverride =
      typeof req.body?.providerIdOverride === 'string' ? req.body.providerIdOverride.trim() : '';

    if (!orderId) {
      res.status(400).json({ ok: false, error: 'orderId is required.' });
      return;
    }

    const fbTarget = resolveRequestFirebaseTarget(req.body);
    let secretKey = '';
    try {
      const orderDoc = await fetchFirestoreDocWithToken(`orders/${orderId}`, idToken, fbTarget);
      if (orderDoc.refunded) {
        res.status(400).json({ ok: false, error: 'Order was already refunded.' });
        return;
      }

      const serviceId = String(orderDoc.serviceId || '').trim();
      const serviceDoc = await fetchFirestoreDocWithToken(`services/${serviceId}`, idToken, fbTarget);
      const lockConfig = getWebsiteLockConfig();

      let providerId = '';
      let apiUrl = '';
      const providerServiceId = String(serviceDoc.providerServiceId || serviceId || '').trim();

      if (lockConfig.locked) {
        if (!lockConfig.baseUrl || !lockConfig.lockedApiKey) {
          res.status(503).json({
            ok: false,
            error: 'Locked RJ WORLD BD API credentials are not configured on the server.',
          });
          return;
        }
        providerId = 'rjw_official_gateway';
        apiUrl = lockConfig.baseUrl;
        secretKey = lockConfig.lockedApiKey;
      } else {
        providerId =
          providerIdOverride ||
          String(orderDoc.providerId || '').trim() ||
          String(serviceDoc.providerId || '').trim();

        if (!providerId || !providerServiceId) {
          res.status(400).json({
            ok: false,
            error: 'Service is not mapped to an API Provider and Provider Service ID.',
          });
          return;
        }

        const providerDoc = await fetchFirestoreDocWithToken(
          `apiProviders/${providerId}`,
          idToken,
          fbTarget
        );
        if (providerDoc.status !== 'active') {
          res.status(400).json({ ok: false, error: 'Mapped API provider is currently inactive.' });
          return;
        }

        apiUrl = String(providerDoc.apiUrl || '').trim();
        secretKey = String(providerDoc.apiKey || '').trim();
        if (!apiUrl || !secretKey) {
          res.status(400).json({ ok: false, error: 'Provider API credentials are incomplete.' });
          return;
        }
      }

      const addRes = (await callUpstreamSmmV2(apiUrl, secretKey, {
        action: 'add',
        service: providerServiceId,
        link: String(orderDoc.link || ''),
        quantity: String(Math.floor(Number(orderDoc.quantity || 0))),
      })) as Record<string, unknown>;

      const providerOrderId = addRes.order !== undefined ? String(addRes.order) : '';
      if (!providerOrderId) {
        throw new Error('Provider did not return a valid order reference.');
      }

      res.json({
        ok: true,
        data: {
          providerId,
          providerOrderId,
        },
      });
    } catch (error) {
      const msg =
        error instanceof Error
          ? sanitizeErrorMessage(error.message, secretKey)
          : 'Unable to dispatch order to provider.';
      res.status(422).json({ ok: false, error: msg });
    }
  });

  /**
   * Secure server-side order status synchronization with controlled retry backoff:
   * Fetches order + provider credentials directly via Firestore REST using Admin's Bearer token,
   * queries the upstream SMM provider API, maps raw provider status to internal status,
   * and returns sanitized sync telemetry (or exponential backoff schedule on failure).
   */
  app.post('/api/orders/sync-status', async (req: Request, res: Response) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Authentication token required.' });
      return;
    }

    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    const forceRetry = Boolean(req.body?.forceRetry);
    if (!orderId) {
      res.status(400).json({ ok: false, error: 'orderId is required.' });
      return;
    }

    const fbTarget = resolveRequestFirebaseTarget(req.body);
    let secretKey = '';
    let currentRetryCount = 0;
    try {
      const orderDoc = await fetchFirestoreDocWithToken(`orders/${orderId}`, idToken, fbTarget);
      const providerId = String(orderDoc.providerId || '').trim();
      const providerOrderId = String(orderDoc.providerOrderId || '').trim();
      currentRetryCount = Math.max(0, Number(orderDoc.retryCount || 0));

      if (!providerId || !providerOrderId) {
        res.status(400).json({
          ok: false,
          error: 'Order has not been dispatched to an API provider yet.',
        });
        return;
      }

      // Enforce controlled retry cooldown unless explicitly triggered by Admin
      if (!forceRetry && typeof orderDoc.nextRetryAt === 'string') {
        const nextMs = Date.parse(orderDoc.nextRetryAt);
        if (Number.isFinite(nextMs) && nextMs > Date.now()) {
          res.status(429).json({
            ok: false,
            retryScheduled: true,
            retryCount: currentRetryCount,
            nextRetryAtMs: nextMs,
            error: 'Retry cooldown active to avoid overloading upstream provider.',
          });
          return;
        }
      }

      const lockConfig = getWebsiteLockConfig();
      let apiUrl = '';
      if (lockConfig.locked) {
        if (!lockConfig.baseUrl || !lockConfig.lockedApiKey) {
          throw new Error('Locked RJ WORLD BD API credentials are missing on the server.');
        }
        apiUrl = lockConfig.baseUrl;
        secretKey = lockConfig.lockedApiKey;
      } else {
        const providerDoc = await fetchFirestoreDocWithToken(
          `apiProviders/${providerId}`,
          idToken,
          fbTarget
        );
        apiUrl = String(providerDoc.apiUrl || '').trim();
        secretKey = String(providerDoc.apiKey || '').trim();
      }

      if (!apiUrl || !secretKey) {
        throw new Error('Provider credentials are missing or incomplete.');
      }

      const remote = (await callUpstreamSmmV2(apiUrl, secretKey, {
        action: 'status',
        order: providerOrderId,
      })) as Record<string, unknown>;

      const rawStatus = String(remote.status ?? 'Pending');
      const mappedStatus = mapProviderStatusToInternal(rawStatus);

      const parsedStart =
        remote.start_count !== undefined && Number.isFinite(Number(remote.start_count))
          ? Math.max(0, Number(remote.start_count))
          : undefined;
      const parsedRemains =
        remote.remains !== undefined && Number.isFinite(Number(remote.remains))
          ? Math.max(0, Number(remote.remains))
          : mappedStatus === 'Completed'
            ? 0
            : undefined;
      const parsedCharge =
        remote.charge !== undefined && Number.isFinite(Number(remote.charge))
          ? Math.max(0, Number(remote.charge))
          : undefined;

      res.json({
        ok: true,
        data: {
          rawStatus,
          mappedStatus,
          startCount: parsedStart,
          remains: parsedRemains,
          providerCharge: parsedCharge,
          refundEligible: mappedStatus === 'Partial',
          autoRefundRecommended: mappedStatus === 'Cancelled' || mappedStatus === 'Failed',
          lastCheckedAtMs: Date.now(),
        },
      });
    } catch (error) {
      const sanitized =
        error instanceof Error
          ? sanitizeErrorMessage(error.message, secretKey)
          : 'Provider status check failed.';
      const schedule = computeNextRetrySchedule(currentRetryCount);
      res.status(422).json({
        ok: false,
        retryScheduled: true,
        retryCount: schedule.retryCount,
        backoffMinutes: schedule.backoffMinutes,
        nextRetryAtMs: schedule.nextRetryAtMs,
        error: sanitized,
      });
    }
  });

  /**
   * Authenticated Admin/Manager Provider Management Proxy (Connection Test, Balance Check, Service Import).
   * Requires Firebase Bearer ID token verified against Firestore RBAC rules.
   * Supports looking up an already-saved provider via `providerId` so stored API keys never need to travel over HTTP.
   */
  app.post('/api/provider/execute', async (req: Request, res: Response) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Admin authentication token required.' });
      return;
    }

    const payload = (req.body ?? {}) as ProviderProxyBody;
    const action = payload.action;
    const providerId = typeof payload.providerId === 'string' ? payload.providerId.trim() : '';
    let apiUrl = typeof payload.apiUrl === 'string' ? payload.apiUrl.trim() : '';
    let apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';

    if (!action) {
      res.status(400).json({ ok: false, error: 'Missing provider action.' });
      return;
    }

    const fbTarget = resolveRequestFirebaseTarget(payload);

    try {
      const lockConfig = getWebsiteLockConfig();
      if (lockConfig.locked) {
        await verifyAdminViaFirestoreRest(idToken, fbTarget);
        if (apiUrl || apiKey || (providerId && providerId !== 'rjw_official_gateway')) {
          res.status(403).json({
            ok: false,
            error:
              'Provider configuration is locked to RJ WORLD BD Official API by Master Admin.',
          });
          return;
        }
        if (!lockConfig.baseUrl || !lockConfig.lockedApiKey) {
          res.status(503).json({
            ok: false,
            error: 'Locked RJ WORLD BD API credentials are not configured on the server.',
          });
          return;
        }
        apiUrl = lockConfig.baseUrl;
        apiKey = lockConfig.lockedApiKey;
      } else if (providerId) {
        const provDoc = await fetchFirestoreDocWithToken(
          `apiProviders/${providerId}`,
          idToken,
          fbTarget
        );
        apiUrl = String(provDoc.apiUrl || '').trim();
        apiKey = String(provDoc.apiKey || '').trim();
      } else {
        await verifyAdminViaFirestoreRest(idToken, fbTarget);
      }

      if (!apiUrl || !apiKey) {
        res.status(400).json({ ok: false, error: 'Provider API URL and API Key are required.' });
        return;
      }
      if (action === 'balance' || action === 'testConnection') {
        const balanceData = (await callUpstreamSmmV2(apiUrl, apiKey, {
          action: 'balance',
        })) as Record<string, unknown>;

        const rawBalance = Number(balanceData.balance ?? 0);
        const currency =
          typeof balanceData.currency === 'string' && balanceData.currency.trim()
            ? balanceData.currency.trim()
            : 'USD';

        if (!Number.isFinite(rawBalance) && !('balance' in balanceData)) {
          throw new Error('Provider balance response did not include a valid balance field.');
        }

        if (action === 'testConnection') {
          res.json({
            ok: true,
            data: {
              ok: true,
              message: 'API Connection Successful',
              balance: Number.isFinite(rawBalance) ? rawBalance : 0,
              currency,
            },
          });
          return;
        }

        res.json({
          ok: true,
          data: {
            balance: Number.isFinite(rawBalance) ? rawBalance : 0,
            currency,
          },
        });
        return;
      }

      if (action === 'services') {
        const rawServices = await callUpstreamSmmV2(apiUrl, apiKey, {
          action: 'services',
        });

        if (!Array.isArray(rawServices)) {
          throw new Error('Provider services endpoint did not return a service list array.');
        }

        res.json({
          ok: true,
          data: rawServices,
        });
        return;
      }

      if (action === 'add') {
        const service = typeof payload.service === 'string' ? payload.service.trim() : '';
        const link = typeof payload.link === 'string' ? payload.link.trim() : '';
        const quantity = Math.floor(Number(payload.quantity ?? 0));

        if (!service || !link || !Number.isFinite(quantity) || quantity < 1) {
          res.status(400).json({
            ok: false,
            error: 'Valid service ID, link, and positive quantity are required.',
          });
          return;
        }

        const addRes = (await callUpstreamSmmV2(apiUrl, apiKey, {
          action: 'add',
          service,
          link,
          quantity: String(quantity),
        })) as Record<string, unknown>;

        res.json({
          ok: true,
          data: {
            order: addRes.order !== undefined ? String(addRes.order) : '',
          },
        });
        return;
      }

      if (action === 'status') {
        const order = typeof payload.order === 'string' ? payload.order.trim() : '';
        if (!order) {
          res.status(400).json({ ok: false, error: 'Provider order ID is required.' });
          return;
        }

        const statusRes = (await callUpstreamSmmV2(apiUrl, apiKey, {
          action: 'status',
          order,
        })) as Record<string, unknown>;

        res.json({
          ok: true,
          data: statusRes,
        });
        return;
      }

      res.status(400).json({ ok: false, error: 'Unsupported provider action.' });
    } catch (error) {
      const msg =
        error instanceof Error
          ? sanitizeErrorMessage(error.message, apiKey)
          : 'Provider request failed.';
      res.status(422).json({
        ok: false,
        error: msg,
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

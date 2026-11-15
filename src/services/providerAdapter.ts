import { getFirebaseServices } from '../lib/firebase/client';
import { getActiveFirebaseTargetPayload } from '../lib/firebase/configManager';
import type { PlatformId, ServiceType } from '../types/service.types';

export type ProviderFormat = 'standard_v2';

export interface ProviderCredentials {
  providerId?: string;
  apiUrl: string;
  apiKey: string;
  format?: ProviderFormat | string;
}

export interface ProviderServiceDTO {
  providerServiceId: string;
  name: string;
  category: string;
  type: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  dripfeed: boolean;
  cancel: boolean;
  description: string;
}

export interface ProviderBalanceResult {
  balance: number;
  currency: string;
}

export interface ProviderConnectionResult {
  ok: boolean;
  message: string;
  balance?: number;
  currency?: string;
}

export interface ProviderAddOrderInput {
  providerServiceId: string;
  link: string;
  quantity: number;
}

export interface ProviderOrderResult {
  providerOrderId: string;
}

export interface ProviderOrderStatusResult {
  status: string;
  startCount?: number;
  remains?: number;
  charge?: number;
  currency?: string;
}

export interface IProviderAdapter {
  readonly format: ProviderFormat;
  testConnection(config: ProviderCredentials): Promise<ProviderConnectionResult>;
  getServices(config: ProviderCredentials): Promise<ProviderServiceDTO[]>;
  getBalance(config: ProviderCredentials): Promise<ProviderBalanceResult>;
  addOrder(
    config: ProviderCredentials,
    input: ProviderAddOrderInput
  ): Promise<ProviderOrderResult>;
  getOrderStatus(
    config: ProviderCredentials,
    providerOrderId: string
  ): Promise<ProviderOrderStatusResult>;
}

function sanitizeClientMessage(message: string, apiKey: string): string {
  const key = apiKey.trim();
  if (!key) return message;
  return message.split(key).join('[REDACTED]');
}

async function postProviderProxy<T>(
  action: 'testConnection' | 'services' | 'balance' | 'add' | 'status',
  config: ProviderCredentials,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const services = getFirebaseServices();
  const currentUser = services?.auth.currentUser;
  if (!currentUser) {
    throw new Error('Admin authentication required to contact provider API.');
  }

  const providerId = config.providerId?.trim() ?? '';
  const apiUrl = config.apiUrl.trim();
  const apiKey = config.apiKey.trim();

  if (!providerId && (!apiUrl || !apiKey)) {
    throw new Error('Provider API URL and API Key are required.');
  }

  const idToken = await currentUser.getIdToken();

  let response: Response;
  try {
    response = await fetch('/api/provider/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        action,
        format: config.format || 'standard_v2',
        ...(providerId ? { providerId } : { apiUrl, apiKey }),
        ...getActiveFirebaseTargetPayload(),
        ...extra,
      }),
    });
  } catch {
    throw new Error('Unable to reach internal provider proxy service.');
  }

  let payload: { ok?: boolean; data?: T; error?: string } | null = null;
  try {
    payload = (await response.json()) as { ok?: boolean; data?: T; error?: string };
  } catch {
    throw new Error('Invalid response received from provider proxy.');
  }

  if (!response.ok || !payload?.ok || payload.data === undefined) {
    const rawMsg = payload?.error || `Provider API call failed (${response.status}).`;
    throw new Error(sanitizeClientMessage(rawMsg, apiKey));
  }

  return payload.data;
}

/**
 * Standard SMM Panel API v2 Adapter (POST key/action endpoints).
 * Isolated for Admin operations & future automated order dispatch without modifying Customer UI.
 */
export class StandardSmmV2Adapter implements IProviderAdapter {
  readonly format: ProviderFormat = 'standard_v2';

  async testConnection(config: ProviderCredentials): Promise<ProviderConnectionResult> {
    return postProviderProxy<ProviderConnectionResult>('testConnection', config);
  }

  async getBalance(config: ProviderCredentials): Promise<ProviderBalanceResult> {
    return postProviderProxy<ProviderBalanceResult>('balance', config);
  }

  async getServices(config: ProviderCredentials): Promise<ProviderServiceDTO[]> {
    const rawList = await postProviderProxy<Record<string, unknown>[]>('services', config);
    return rawList
      .map((item) => {
        const providerServiceId = String(item.service ?? item.id ?? '').trim();
        const name = String(item.name ?? '').trim();
        if (!providerServiceId || !name) return null;

        const min = Math.max(1, Math.floor(Number(item.min ?? 10) || 10));
        const max = Math.max(min, Math.floor(Number(item.max ?? 10000) || 10000));
        const rate = Math.max(0, Number(item.rate ?? 0) || 0);

        return {
          providerServiceId,
          name,
          category: String(item.category ?? 'General').trim() || 'General',
          type: String(item.type ?? 'Default').trim() || 'Default',
          rate,
          min,
          max,
          refill: Boolean(item.refill === true || item.refill === 1 || item.refill === '1'),
          dripfeed: Boolean(
            item.dripfeed === true || item.dripfeed === 1 || item.dripfeed === '1'
          ),
          cancel: Boolean(item.cancel === true || item.cancel === 1 || item.cancel === '1'),
          description: typeof item.desc === 'string' ? item.desc.trim() : '',
        } satisfies ProviderServiceDTO;
      })
      .filter((entry): entry is ProviderServiceDTO => entry !== null);
  }

  async addOrder(
    config: ProviderCredentials,
    input: ProviderAddOrderInput
  ): Promise<ProviderOrderResult> {
    const result = await postProviderProxy<{ order: string }>('add', config, {
      service: input.providerServiceId,
      link: input.link,
      quantity: input.quantity,
    });
    return {
      providerOrderId: result.order ?? '',
    };
  }

  async getOrderStatus(
    config: ProviderCredentials,
    providerOrderId: string
  ): Promise<ProviderOrderStatusResult> {
    const res = await postProviderProxy<Record<string, unknown>>('status', config, {
      order: providerOrderId,
    });
    return {
      status: String(res.status ?? 'Pending'),
      startCount: res.start_count !== undefined ? Number(res.start_count) : undefined,
      remains: res.remains !== undefined ? Number(res.remains) : undefined,
      charge: res.charge !== undefined ? Number(res.charge) : undefined,
      currency: typeof res.currency === 'string' ? res.currency : undefined,
    };
  }
}

const ADAPTER_REGISTRY: Record<string, IProviderAdapter> = {
  standard_v2: new StandardSmmV2Adapter(),
};

export function getProviderAdapter(format: string = 'standard_v2'): IProviderAdapter {
  return ADAPTER_REGISTRY[format] ?? ADAPTER_REGISTRY.standard_v2;
}

/**
 * Helper to suggest a local platform category ID & ServiceType from an imported provider service row.
 */
export function suggestPlatformAndTypeFromImported(
  serviceName: string,
  providerCategory: string,
  fallbackCategoryId: string = 'instagram'
): { categoryId: PlatformId; serviceType: ServiceType } {
  const combined = `${providerCategory} ${serviceName}`.toLowerCase();

  let categoryId: PlatformId = (fallbackCategoryId || 'more') as PlatformId;
  if (combined.includes('instagram') || combined.includes('ig ')) categoryId = 'instagram';
  else if (combined.includes('youtube') || combined.includes('yt ')) categoryId = 'youtube';
  else if (combined.includes('facebook') || combined.includes('fb ')) categoryId = 'facebook';
  else if (combined.includes('tiktok')) categoryId = 'tiktok';
  else if (combined.includes('telegram') || combined.includes('tg ')) categoryId = 'telegram';
  else if (combined.includes('twitter') || combined.includes('x ')) categoryId = 'x';
  else if (combined.includes('linkedin')) categoryId = 'linkedin';
  else if (
    combined.includes('web traffic') ||
    combined.includes('website traffic') ||
    combined.includes('webtraffic') ||
    combined.includes('traffic')
  )
    categoryId = 'webtraffic';

  let serviceType: ServiceType = 'Other';
  if (combined.includes('follower')) serviceType = 'Followers';
  else if (combined.includes('subscriber')) serviceType = 'Subscribers';
  else if (combined.includes('member')) serviceType = 'Members';
  else if (combined.includes('like') || combined.includes('reaction')) serviceType = 'Likes';
  else if (combined.includes('view') || combined.includes('watch')) serviceType = 'Views';
  else if (combined.includes('comment')) serviceType = 'Comments';
  else if (combined.includes('share') || combined.includes('repost') || combined.includes('retweet'))
    serviceType = 'Shares';

  return { categoryId, serviceType };
}

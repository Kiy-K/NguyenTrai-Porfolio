interface MuxApiEnvelope<T> {
  data?: T;
}

interface MuxPlaybackId {
  id: string;
  policy?: string;
}

export interface MuxUpload {
  id: string;
  status: 'waiting' | 'asset_created' | 'errored' | 'cancelled' | 'timed_out';
  url?: string;
  asset_id?: string;
}

export interface MuxAsset {
  id: string;
  status: 'preparing' | 'ready' | 'errored';
  playback_ids?: MuxPlaybackId[];
}

const MUX_API_BASE_URL = 'https://api.mux.com';

const getMuxCredentials = () => {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error('Missing Mux credentials');
  }

  return { tokenId, tokenSecret };
};

const createAuthHeader = () => {
  const { tokenId, tokenSecret } = getMuxCredentials();
  const encoded = Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');
  return `Basic ${encoded}`;
};

const readErrorBody = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return '';
  }
};

async function muxRequest<T>(path: string, init?: Omit<RequestInit, 'body'> & { body?: unknown }) {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', createAuthHeader());
  headers.set('Accept', 'application/json');

  const hasBody = typeof init?.body !== 'undefined';
  if (hasBody) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${MUX_API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
    body: hasBody ? JSON.stringify(init?.body) : undefined,
  });

  if (!response.ok) {
    const details = await readErrorBody(response);
    throw new Error(`Mux API ${response.status}: ${details || response.statusText}`);
  }

  const payload = (await response.json()) as MuxApiEnvelope<T>;
  if (!payload?.data) {
    throw new Error('Mux API returned an empty data payload');
  }

  return payload.data;
}

export const createMuxUpload = (corsOrigin: string) =>
  muxRequest<MuxUpload>('/video/v1/uploads', {
    method: 'POST',
    body: {
      cors_origin: corsOrigin,
      new_asset_settings: {
        playback_policy: ['public'],
      },
    },
  });

export const retrieveMuxUpload = (uploadId: string) =>
  muxRequest<MuxUpload>(`/video/v1/uploads/${encodeURIComponent(uploadId)}`, {
    method: 'GET',
  });

export const retrieveMuxAsset = (assetId: string) =>
  muxRequest<MuxAsset>(`/video/v1/assets/${encodeURIComponent(assetId)}`, {
    method: 'GET',
  });

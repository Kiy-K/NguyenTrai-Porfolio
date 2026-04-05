import { redis } from '@/lib/redis';

export const FEEDBACK_SEARCH_INDEX = 'feedback_idx_v1';
export const FEEDBACK_KEY_PREFIX = 'feedback:record:';

const SEARCH_INDEX_ALREADY_EXISTS_ERROR = 'already exists';

let ensureIndexPromise: Promise<void> | null = null;

const isAlreadyExistsError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes(SEARCH_INDEX_ALREADY_EXISTS_ERROR);
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const normalizeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return String(value);
};

const mapCandidateToRow = (candidate: unknown): Record<string, string> | null => {
  const directObject = toRecord(candidate);
  if (!directObject) return null;

  const nested =
    toRecord(directObject.value) ??
    toRecord(directObject.doc) ??
    toRecord(directObject.fields) ??
    toRecord(directObject.content) ??
    directObject;

  const row: Record<string, string> = {};
  for (const [field, value] of Object.entries(nested)) {
    row[field] = normalizeValue(value);
  }
  return row;
};

export async function ensureFeedbackSearchIndex(): Promise<void> {
  if (ensureIndexPromise) {
    return ensureIndexPromise;
  }

  ensureIndexPromise = (async () => {
    try {
      await redis.exec([
        'SEARCH.CREATE',
        FEEDBACK_SEARCH_INDEX,
        'ON',
        'HASH',
        'PREFIX',
        '1',
        FEEDBACK_KEY_PREFIX,
        'SCHEMA',
        'id',
        'KEYWORD',
        'nameHash',
        'KEYWORD',
        'classHash',
        'KEYWORD',
        'emailHash',
        'KEYWORD',
        'text',
        'TEXT',
        'rating',
        'I64',
        'FAST',
        'videoId',
        'KEYWORD',
        'createdAt',
        'TEXT',
        'createdAtUnix',
        'U64',
        'FAST',
      ]);
    } catch (error) {
      if (!isAlreadyExistsError(error)) {
        throw error;
      }
    }
  })();

  try {
    await ensureIndexPromise;
  } catch (error) {
    ensureIndexPromise = null;
    throw error;
  }
}

export async function searchFeedbackByNewest(limit: number): Promise<Record<string, string>[]> {
  await ensureFeedbackSearchIndex();

  const raw = await redis.exec<unknown>([
    'SEARCH.QUERY',
    FEEDBACK_SEARCH_INDEX,
    '{}',
    'ORDERBY',
    'createdAtUnix',
    'DESC',
    'LIMIT',
    String(Math.max(1, Math.floor(limit))),
  ]);

  if (Array.isArray(raw)) {
    return raw.map(mapCandidateToRow).filter((row): row is Record<string, string> => Boolean(row?.id));
  }

  const objectResult = toRecord(raw);
  const results = Array.isArray(objectResult?.results) ? objectResult.results : [];
  return results
    .map(mapCandidateToRow)
    .filter((row): row is Record<string, string> => Boolean(row?.id));
}

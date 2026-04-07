export interface ParsedTextSegment {
  type: 'text' | 'url';
  value: string;
}

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = '.,!?;:)]}';

const stripTrailingPunctuation = (input: string): string => {
  let url = input;
  while (url.length > 0) {
    const lastChar = url[url.length - 1];
    if (!TRAILING_PUNCTUATION.includes(lastChar)) break;
    url = url.slice(0, -1);
  }
  return url;
};

export function parseTextWithUrls(text: string): ParsedTextSegment[] {
  if (!text) return [];

  const segments: ParsedTextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const matchStart = match.index;
    const rawMatch = match[0];
    const normalizedUrl = stripTrailingPunctuation(rawMatch);
    const matchEnd = matchStart + normalizedUrl.length;

    if (matchStart > cursor) {
      segments.push({
        type: 'text',
        value: text.slice(cursor, matchStart),
      });
    }

    segments.push({ type: 'url', value: normalizedUrl });
    cursor = matchEnd;

    if (rawMatch.length !== normalizedUrl.length) {
      const trailing = rawMatch.slice(normalizedUrl.length);
      if (trailing) {
        segments.push({ type: 'text', value: trailing });
      }
      cursor = matchStart + rawMatch.length;
    }
  }

  if (cursor < text.length) {
    segments.push({
      type: 'text',
      value: text.slice(cursor),
    });
  }

  return segments.filter((segment) => segment.value.length > 0);
}

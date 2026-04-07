import { parseTextWithUrls } from '@/lib/url-parser';
import { ContentDocument, ContentParser, InlineNode } from '@/lib/content/types';

const textToInlines = (value: string): InlineNode[] => {
  return parseTextWithUrls(value).map((segment) =>
    segment.type === 'url'
      ? { type: 'link', url: segment.value }
      : { type: 'text', value: segment.value }
  );
};

export const plainTextContentParser: ContentParser<string> = {
  id: 'plain-text',
  parse(input) {
    if (!input.trim()) {
      return { format: 'plain-text', blocks: [] };
    }

    const paragraphTexts = input
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    return {
      format: 'plain-text',
      blocks: paragraphTexts.map((paragraphText) => ({
        type: 'paragraph',
        inlines: textToInlines(paragraphText),
      })),
    };
  },
};

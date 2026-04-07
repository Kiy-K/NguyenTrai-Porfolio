export interface TextInlineNode {
  type: 'text';
  value: string;
}

export interface LinkInlineNode {
  type: 'link';
  url: string;
}

export type InlineNode = TextInlineNode | LinkInlineNode;

export interface ParagraphBlockNode {
  type: 'paragraph';
  inlines: InlineNode[];
}

export type ContentBlockNode = ParagraphBlockNode;

export interface ContentDocument {
  format: 'plain-text' | 'markdown';
  blocks: ContentBlockNode[];
}

export interface ContentParser<TInput = string> {
  id: string;
  parse(input: TInput): ContentDocument;
}

import { Fragment } from 'react';
import SmartEmbed from '@/components/SmartEmbed';
import { plainTextContentParser } from '@/lib/content/plain-text-parser';
import { ContentDocument, ContentParser, InlineNode } from '@/lib/content/types';

interface RichTextWithEmbedsProps {
  text?: string;
  document?: ContentDocument;
  parser?: ContentParser<string>;
}

function renderTextSegment(value: string) {
  const lines = value.split('\n');
  return (
    <Fragment>
      {lines.map((line, index) => (
        <Fragment key={`line-${index}`}>
          {line}
          {index < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </Fragment>
  );
}

function renderInlineNode(node: InlineNode) {
  if (node.type === 'link') {
    return <SmartEmbed url={node.url} />;
  }

  return <Fragment>{renderTextSegment(node.value)}</Fragment>;
}

export default function RichTextWithEmbeds({
  text,
  document,
  parser = plainTextContentParser,
}: RichTextWithEmbedsProps) {
  const resolvedDocument = document ?? parser.parse(text || '');
  if (resolvedDocument.blocks.length === 0) return null;

  return (
    <div className="space-y-4">
      {resolvedDocument.blocks.map((block, blockIndex) => {
        const key = `block-${blockIndex}`;
        if (block.type !== 'paragraph') return null;

        return (
          <div key={key} className="space-y-4">
            {block.inlines.map((inline, inlineIndex) => {
              const inlineKey = `${key}-inline-${inlineIndex}`;
              if (inline.type === 'link') {
                return <div key={inlineKey}>{renderInlineNode(inline)}</div>;
              }
              return <p key={inlineKey}>{renderInlineNode(inline)}</p>;
            })}
          </div>
        );
      })}
    </div>
  );
}

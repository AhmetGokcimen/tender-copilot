/**
 * Document converters for the workspace. Tiptap JSON is the canonical edited
 * state of each generated document:
 *
 *   template Markdown --sectionsToTiptap--> editor JSON --tiptapToMarkdown--> PDF blocks
 *
 * Both directions cover only our controlled subset (headings, paragraphs,
 * bold/italic, bullet + ordered lists, GFM tables) — the same subset the
 * mock generator emits and the PDF renderer parses.
 */
import type { JSONContent } from '@tiptap/react';
import type { DraftSection } from './types';

type InlineNode = { type: 'text'; text: string; marks?: { type: 'bold' | 'italic' }[] };

/** `**bold**` / `*italic*` spans → Tiptap text nodes (mirrors the PDF rich()). */
export function parseInline(text: string): InlineNode[] {
  const out: InlineNode[] = [];
  for (const part of text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)) {
    if (part === '') continue;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      out.push({ type: 'text', text: part.slice(2, -2), marks: [{ type: 'bold' }] });
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      out.push({ type: 'text', text: part.slice(1, -1), marks: [{ type: 'italic' }] });
    } else {
      out.push({ type: 'text', text: part });
    }
  }
  return out.length > 0 ? out : [{ type: 'text', text: '' }];
}

function splitRow(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function tableNode(header: string[], rows: string[][]): JSONContent {
  const cell = (text: string, headerCell: boolean): JSONContent => ({
    type: headerCell ? 'tableHeader' : 'tableCell',
    content: [{ type: 'paragraph', content: parseInline(text) }],
  });
  return {
    type: 'table',
    content: [
      { type: 'tableRow', content: header.map((c) => cell(c, true)) },
      ...rows.map((row) => ({
        type: 'tableRow',
        content: row.map((c) => cell(c, false)),
      })),
    ],
  };
}

/** Template sections → editor document. Section titles become h2 headings. */
export function sectionsToTiptap(sections: DraftSection[]): JSONContent {
  const content: JSONContent[] = [];
  for (const s of sections) {
    content.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: s.title }] });
    const lines = s.body.split('\n');
    const para: string[] = [];
    const pushPara = () => {
      if (para.length > 0) {
        content.push({ type: 'paragraph', content: parseInline(para.join(' ')) });
        para.length = 0;
      }
    };
    let i = 0;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (t === '') {
        pushPara();
        i++;
        continue;
      }
      if (t.startsWith('## ')) {
        pushPara();
        content.push({
          type: 'heading',
          attrs: { level: 2 },
          content: parseInline(t.slice(3).trim()),
        });
        i++;
        continue;
      }
      if (t.startsWith('# ')) {
        pushPara();
        content.push({
          type: 'heading',
          attrs: { level: 1 },
          content: parseInline(t.slice(2).trim()),
        });
        i++;
        continue;
      }
      if (/^\|.*\|$/.test(t)) {
        pushPara();
        const header = splitRow(t);
        i++;
        if (i < lines.length && /^\|[\s:|-]+\|$/.test(lines[i].trim())) i++;
        const rows: string[][] = [];
        while (i < lines.length && /^\|.*\|$/.test(lines[i].trim())) {
          rows.push(splitRow(lines[i].trim()));
          i++;
        }
        if (header.length > 0) content.push(tableNode(header, rows));
        continue;
      }
      if (/^[-*] /.test(t)) {
        pushPara();
        const items: JSONContent[] = [];
        while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
          items.push({
            type: 'listItem',
            content: [{ type: 'paragraph', content: parseInline(lines[i].trim().slice(2)) }],
          });
          i++;
        }
        content.push({ type: 'bulletList', content: items });
        continue;
      }
      if (/^\d+\. /.test(t)) {
        pushPara();
        const items: JSONContent[] = [];
        while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
          items.push({
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: parseInline(lines[i].trim().replace(/^\d+\. /, '')),
              },
            ],
          });
          i++;
        }
        content.push({ type: 'orderedList', content: items });
        continue;
      }
      para.push(t);
      i++;
    }
    pushPara();
  }
  return { type: 'doc', content };
}

function inlineToMd(nodes: JSONContent[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type !== 'text') return '';
      const marks = (n.marks ?? []).map((m) => m.type);
      if (marks.includes('bold')) return `**${n.text ?? ''}**`;
      if (marks.includes('italic')) return `*${n.text ?? ''}*`;
      return n.text ?? '';
    })
    .join('');
}

function inlineToMdStripped(nodes: JSONContent[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === 'text' ? (n.text ?? '') : '')).join('');
}

function listItemsToMd(list: JSONContent, ordered: boolean): string[] {
  return (list.content ?? []).map((item, i) => {
    const first = (item.content ?? [])[0];
    const text = first?.type === 'text' ? (first.text ?? '') : inlineToMd(first?.content);
    return `${ordered ? `${i + 1}. ` : '- '}${text}`;
  });
}

function tableToMd(table: JSONContent): string[] {
  const rows = (table.content ?? []).filter((r) => r.type === 'tableRow');
  const cellText = (cell: JSONContent): string => {
    const p = (cell.content ?? []).find(
      (c) => c.type === 'paragraph' || c.type === 'heading' || c.type === 'text',
    );
    if (!p) return '';
    return p.type === 'text' ? (p.text ?? '') : inlineToMd(p.content);
  };
  const grid = rows.map((r) => (r.content ?? []).map(cellText));
  if (grid.length === 0) return [];
  // First row is the header (Tiptap guarantees tableHeader for row 0 in our docs).
  const md = [`| ${grid[0].join(' | ')} |`];
  md.push(`| ${grid[0].map(() => '---').join(' | ')} |`);
  for (const row of grid.slice(1)) md.push(`| ${row.join(' | ')} |`);
  return md;
}

/** Editor document → Markdown (feeds the existing PDF block parser). */
export function tiptapToMarkdown(doc: JSONContent): string {
  const out: string[] = [];
  for (const node of doc.content ?? []) {
    switch (node.type) {
      case 'heading': {
        const level = node.attrs?.level === 1 ? '#' : '##';
        out.push(`${level} ${inlineToMd(node.content)}`);
        break;
      }
      case 'paragraph': {
        const text = inlineToMd(node.content);
        if (text.trim() !== '') out.push(text);
        break;
      }
      case 'bulletList':
        out.push(...listItemsToMd(node, false));
        break;
      case 'orderedList':
        out.push(...listItemsToMd(node, true));
        break;
      case 'table':
        out.push(...tableToMd(node));
        break;
      default:
        break;
    }
    out.push('');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Plain text of the whole document (copy, AI context, search). */
export function tiptapToText(doc: JSONContent): string {
  const texts: string[] = [];
  const walk = (node: JSONContent) => {
    if (node.type === 'text' && node.text) texts.push(node.text);
    for (const child of node.content ?? []) walk(child);
  };
  walk(doc);
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

/** h1/h2 heading texts in order (completeness + revision targeting). */
export function docHeadings(doc: JSONContent): string[] {
  return (doc.content ?? [])
    .filter((n) => n.type === 'heading')
    .map((n) => inlineToMdStripped(n.content));
}

/** Top-level paragraph texts in order (revision targeting). */
export function docParagraphs(doc: JSONContent): string[] {
  const out: string[] = [];
  for (const node of doc.content ?? []) {
    if (node.type === 'paragraph') {
      const text = inlineToMdStripped(node.content);
      if (text.trim()) out.push(text);
    }
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      for (const item of node.content ?? []) {
        const p = (item.content ?? []).find((c) => c.type === 'paragraph');
        if (p) {
          const text = inlineToMdStripped(p.content);
          if (text.trim()) out.push(text);
        }
      }
    }
  }
  return out;
}

export interface AppliedRevision {
  doc: JSONContent;
  applied: boolean;
}

/**
 * Applies an accepted AI revision to a document copy: replaces the first
 * top-level paragraph containing `target`, or appends when target is empty.
 */
export function applyRevisionToJson(
  doc: JSONContent,
  target: string,
  after: string,
): AppliedRevision {
  const next: JSONContent = JSON.parse(JSON.stringify(doc)) as JSONContent;
  const replacement: JSONContent = { type: 'paragraph', content: parseInline(after) };
  if (target.trim() === '') {
    next.content = [...(next.content ?? []), replacement];
    return { doc: next, applied: true };
  }
  const blocks = next.content ?? [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type === 'paragraph' && inlineToMdStripped(b.content).includes(target)) {
      blocks[i] = replacement;
      next.content = blocks;
      return { doc: next, applied: true };
    }
  }
  return { doc: next, applied: false };
}

/** Word count for save/completeness indicators. */
export function docWordCount(doc: JSONContent): number {
  const text = tiptapToText(doc);
  return text === '' ? 0 : text.split(/\s+/).length;
}

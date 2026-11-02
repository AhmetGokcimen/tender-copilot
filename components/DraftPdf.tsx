/**
 * Business-document PDF export for the bid documents: A4, in the layout of the
 * forms Romanian contracting authorities publish (centered capitalised title,
 * identification grid, ruled numbered sections, fully bordered tables with
 * "Nr. crt." columns, signature block, "Pagina x din y"). The body is the
 * document's CURRENT edited Markdown (serialized from the rich-text editor),
 * so the export always matches the on-screen preview.
 *
 * Text is set in Noto Sans (subset in /public/fonts): the built-in PDF fonts
 * have no glyphs for ș, ț and ă, which official Romanian text needs.
 */
import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CompanyProfile, TenderWithState } from '@/lib/types';
import type { DocType } from '@/stores/useGeneratorStore';
import { DOC_TITLES_RO, roDate } from '@/lib/draft-template';

// In the browser the fonts are fetched from /fonts; a Node render (tests) reads them from disk.
const FONT_DIR = typeof window === 'undefined' ? `${process.cwd()}/public/fonts` : '/fonts';

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: `${FONT_DIR}/NotoSans-Regular.ttf`, fontWeight: 400 },
    { src: `${FONT_DIR}/NotoSans-Bold.ttf`, fontWeight: 700 },
    { src: `${FONT_DIR}/NotoSans-Italic.ttf`, fontWeight: 400, fontStyle: 'italic' },
    { src: `${FONT_DIR}/NotoSans-ItalicBold.ttf`, fontWeight: 700, fontStyle: 'italic' },
  ],
});
// The default English hyphenation splits Romanian words in the wrong places.
Font.registerHyphenationCallback((word) => [word]);

const INK = '#111827';
const MUTED = '#4B5563';
const LINE = '#6B7280';
const SOFT = '#D1D5DB';
const HEAD_BG = '#E5E7EB';

const styles = StyleSheet.create({
  // No page-level lineHeight: it drops fixed render-prop nodes (page numbers)
  // in the browser build. Text styles carry their own.
  page: {
    paddingTop: 66,
    paddingBottom: 70,
    paddingHorizontal: 54,
    fontFamily: 'NotoSans',
    fontSize: 9.5,
    color: INK,
  },
  headerLeft: { position: 'absolute', top: 26, left: 54, fontSize: 7.5, color: MUTED },
  headerRight: { position: 'absolute', top: 26, right: 54, fontSize: 7.5, color: MUTED, textAlign: 'right' },
  headerRule: { position: 'absolute', top: 40, left: 54, right: 54, borderBottomWidth: 0.5, borderBottomColor: SOFT },
  footerRule: { position: 'absolute', bottom: 44, left: 54, right: 54, borderBottomWidth: 0.5, borderBottomColor: SOFT },
  footerLeft: { position: 'absolute', bottom: 28, left: 54, fontSize: 7.5, color: MUTED },
  footerRight: { position: 'absolute', bottom: 28, right: 54, fontSize: 7.5, color: MUTED, textAlign: 'right' },

  title: { fontSize: 15, fontWeight: 700, textAlign: 'center', letterSpacing: 0.6, marginTop: 6 },
  subtitle: { fontSize: 9.5, textAlign: 'center', color: MUTED, marginTop: 5, lineHeight: 1.4 },
  titleRule: { borderBottomWidth: 1.2, borderBottomColor: INK, marginTop: 12, marginBottom: 12 },

  dateLine: { fontSize: 9, color: MUTED, textAlign: 'right', marginBottom: 4 },
  grid: { borderWidth: 0.75, borderColor: LINE, marginBottom: 14 },
  gridRow: { flexDirection: 'row', borderBottomWidth: 0.75, borderBottomColor: LINE },
  gridLabel: { width: '30%', padding: 5, fontSize: 8.5, fontWeight: 700, backgroundColor: HEAD_BG, borderRightWidth: 0.75, borderRightColor: LINE },
  gridValue: { flex: 1, padding: 5, fontSize: 9, lineHeight: 1.35 },

  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 3 },
  sectionRule: { borderBottomWidth: 0.75, borderBottomColor: INK, marginBottom: 7 },
  p: { fontSize: 9.5, marginBottom: 6, lineHeight: 1.5, textAlign: 'justify' },
  note: { fontSize: 8.5, marginBottom: 6, lineHeight: 1.45, color: MUTED, fontStyle: 'italic' },
  bulletRow: { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
  bulletMark: { width: 14, fontSize: 9.5 },
  bulletText: { flex: 1, fontSize: 9.5, lineHeight: 1.45, textAlign: 'justify' },

  table: { marginBottom: 9, borderTopWidth: 0.75, borderLeftWidth: 0.75, borderColor: LINE },
  row: { flexDirection: 'row' },
  headRow: { flexDirection: 'row', backgroundColor: HEAD_BG },
  cell: {
    paddingVertical: 4,
    paddingHorizontal: 5,
    fontSize: 8.8,
    lineHeight: 1.35,
    borderRightWidth: 0.75,
    borderBottomWidth: 0.75,
    borderColor: LINE,
  },
  bold: { fontWeight: 700 },
  italic: { fontStyle: 'italic' },
});

type Block =
  | { kind: 'h1'; text: string }
  | { kind: 'h2'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'table'; header: string[]; rows: string[][] };

function splitRow(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** Minimal Markdown parser for our controlled template/editor subset. */
export function parseMarkdownBlocks(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  const para: string[] = [];
  const pushPara = () => {
    if (para.length > 0) {
      blocks.push({ kind: 'p', text: para.join(' ') });
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
    if (t.startsWith('# ')) {
      pushPara();
      blocks.push({ kind: 'h1', text: t.slice(2).trim() });
      i++;
      continue;
    }
    if (t.startsWith('## ')) {
      pushPara();
      blocks.push({ kind: 'h2', text: t.slice(3).trim() });
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
      blocks.push({ kind: 'table', header, rows });
      continue;
    }
    if (/^[-*] /.test(t)) {
      pushPara();
      const items: string[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i].trim())) {
        items.push(lines[i].trim().slice(2));
        i++;
      }
      blocks.push({ kind: 'ul', items });
      continue;
    }
    if (/^\d+\. /.test(t)) {
      pushPara();
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\. /, ''));
        i++;
      }
      blocks.push({ kind: 'ol', items });
      continue;
    }
    para.push(t);
    i++;
  }
  pushPara();
  return blocks;
}

/** Inline **bold** and *italic* spans. */
function rich(text: string, key: string) {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, j) => {
    const k = `${key}-${j}`;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={k} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <Text key={k} style={styles.italic}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return <Text key={k}>{part}</Text>;
  });
}

const NARROW = /^(nr\.?\s*crt\.?|nr\.?|secțiunea|conform|da\/nu)$/i;
const SMALL = /^(u\.?m\.?|cantitate|durată)$/i;

/** Column widths: index and yes/no columns slim, the rest by how much text they carry. */
function columnWeights(header: string[], rows: string[][]): number[] {
  return header.map((h, c) => {
    const label = h.replace(/\*/g, '').trim();
    if (NARROW.test(label)) return 0.5;
    if (SMALL.test(label)) return 0.75;
    const longest = Math.max(label.length, ...rows.map((r) => (r[c] ?? '').length));
    return Math.min(3.2, Math.max(1, Math.sqrt(longest / 12)));
  });
}

const isBlank = (s: string) => /^[….\s_]+$/.test(s);

function TableView({ block, index }: { block: Extract<Block, { kind: 'table' }>; index: number }) {
  const w = columnWeights(block.header, block.rows);
  const signature = /^Data completării/i.test(block.header[0] ?? '');
  const cols = block.header.length;
  const align = (c: number) => (NARROW.test(block.header[c].replace(/\*/g, '').trim()) ? 'center' : 'left');
  return (
    <View style={styles.table} wrap={block.rows.length > 8}>
      <View style={styles.headRow} wrap={false}>
        {block.header.map((c, j) => (
          <Text key={`h${index}-${j}`} style={[styles.cell, styles.bold, { flex: w[j], textAlign: align(j) }]}>
            {rich(c, `th${index}-${j}`)}
          </Text>
        ))}
      </View>
      {block.rows.map((row, r) => (
        <View key={`r${index}-${r}`} style={styles.row} wrap={false}>
          {Array.from({ length: cols }, (_, j) => row[j] ?? '').map((c, j) => (
            <Text
              key={`c${index}-${r}-${j}`}
              style={[
                styles.cell,
                { flex: w[j], textAlign: align(j) },
                ...(signature ? [{ minHeight: 54 }] : []),
                ...(isBlank(c) && !signature ? [{ color: MUTED }] : []),
              ]}
            >
              {signature && isBlank(c) ? '' : rich(c, `td${index}-${r}-${j}`)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function BlockView({ block, index }: { block: Block; index: number }) {
  if (block.kind === 'h1' || block.kind === 'h2') {
    return (
      <View wrap={false} minPresenceAhead={70}>
        <Text style={styles.sectionTitle}>{rich(block.text, `h${index}`)}</Text>
        <View style={styles.sectionRule} />
      </View>
    );
  }
  if (block.kind === 'p') {
    const note = /^Notă:/i.test(block.text);
    return <Text style={note ? styles.note : styles.p}>{rich(block.text, `p${index}`)}</Text>;
  }
  if (block.kind === 'table') return <TableView block={block} index={index} />;
  return (
    <View>
      {block.items.map((item, j) => (
        <View key={`li${index}-${j}`} style={styles.bulletRow} wrap={false}>
          <Text style={styles.bulletMark}>{block.kind === 'ol' ? `${j + 1}.` : '•'}</Text>
          <Text style={styles.bulletText}>{rich(item, `li${index}-${j}`)}</Text>
        </View>
      ))}
    </View>
  );
}

export function DraftPdfDocument({
  tender,
  company,
  doc,
  markdown,
}: {
  tender: TenderWithState;
  company: CompanyProfile;
  doc: DocType;
  /** Current edited document body (## section headings + Markdown blocks). */
  markdown: string;
}) {
  const title = DOC_TITLES_RO[doc];
  return (
    <Document title={`${title} — ${tender.external_id}`} author={company.name} subject={`Procedura ${tender.external_id}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.headerLeft} fixed>
          {company.name} · CUI {company.cui}
        </Text>
        <Text style={styles.headerRight} fixed>
          Procedura {tender.external_id}
        </Text>
        <View style={styles.headerRule} fixed />
        <View style={styles.footerRule} fixed />

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{tender.title}</Text>
        <View style={styles.titleRule} />

        <Text style={styles.dateLine}>Data: {roDate()}</Text>

        {parseMarkdownBlocks(markdown).map((b, bi) => (
          <BlockView key={`b${bi}`} block={b} index={bi} />
        ))}

        <Text style={styles.footerLeft} fixed>
          Proiect pregătit cu Licits, de verificat înainte de depunere.
        </Text>
        <Text
          style={styles.footerRight}
          fixed
          render={({ pageNumber, totalPages }) => `Pagina ${pageNumber} din ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

const DOC_FILE_LABELS: Record<DocType, string> = {
  technical: 'Propunere_tehnica',
  financial: 'Propunere_financiara',
  duae: 'DUAE',
};

export function draftFileName(tender: TenderWithState, company: CompanyProfile, doc: DocType): string {
  const safe = (v: string) =>
    v
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  return `${safe(tender.external_id)}_${DOC_FILE_LABELS[doc]}_${safe(company.name)}.pdf`;
}

/**
 * Business-document PDF export for workspace documents: A4 layout, company
 * letterhead with Romanian submission conventions (Operator economic / CUI /
 * Autoritate contractantă), section rules, page numbers. The body is the
 * document's CURRENT edited Markdown (serialized from the rich-text editor),
 * so the export always matches the on-screen A4 preview. Agent-attribution
 * tags stay in the UI only; the PDF carries a single discreet footer line.
 */
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { CompanyProfile, TenderWithState } from '@/lib/types';
import type { DocType } from '@/stores/useGeneratorStore';
import { DOC_TITLES } from '@/lib/draft-template';
import { formatDate } from '@/lib/format';

const NAVY = '#0B132B';
const INK = '#0B1C30';
const MUTED = '#45464D';
const FAINT = '#76767E';
const RULE = '#C6C6CE';
const TINT = '#EFF4FF';

const styles = StyleSheet.create({
  // NOTE: no lineHeight here — a page-level lineHeight silently drops fixed
  // render-prop nodes (page numbers) in the browser build (v4.9.0). Body text
  // styles below carry their own lineHeight instead.
  page: {
    paddingTop: 48,
    // Deep bottom padding: body content must never flow under the fixed
    // footer zone (footer sits 28pt from the edge).
    paddingBottom: 76,
    paddingHorizontal: 52,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: INK,
  },
  letterName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: NAVY },
  letterMeta: { fontSize: 9, color: MUTED, marginTop: 4 },
  docTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 16 },
  docSub: { fontSize: 9, color: MUTED, marginTop: 2 },
  rule: { borderBottomWidth: 2, borderBottomColor: NAVY, marginTop: 8, marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: NAVY, marginTop: 14, marginBottom: 4 },
  sectionRule: { borderBottomWidth: 1, borderBottomColor: RULE, marginBottom: 8 },
  p: { fontSize: 10, marginBottom: 6, lineHeight: 1.5 },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bulletMark: { width: 12, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.5 },
  table: { marginBottom: 8, borderWidth: 1, borderColor: RULE },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: TINT },
  tableRow: { flexDirection: 'row' },
  tableCell: { flex: 1, padding: 5, fontSize: 9, borderRightWidth: 1, borderRightColor: RULE, lineHeight: 1.5 },
  // Two separate fixed nodes on purpose: a render-prop child inside a single
  // absolute+fixed View is silently dropped by the browser build (v4.9.0).
  footerLeft: {
    position: 'absolute',
    bottom: 28,
    left: 52,
    fontSize: 8,
    color: FAINT,
  },
  footerRight: {
    position: 'absolute',
    bottom: 28,
    right: 52,
    fontSize: 8,
    color: FAINT,
    textAlign: 'right',
  },
  bold: { fontFamily: 'Helvetica-Bold' },
  italic: { fontFamily: 'Helvetica-Oblique' },
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
    // eslint-disable-next-line react/jsx-key
    return <Text key={k}>{part}</Text>;
  });
}

function BlockView({ block, index }: { block: Block; index: number }) {
  if (block.kind === 'h1' || block.kind === 'h2') {
    return (
      <View>
        <Text style={styles.sectionTitle}>{rich(block.text, `h${index}`)}</Text>
        <View style={styles.sectionRule} />
      </View>
    );
  }
  if (block.kind === 'p') {
    return <Text style={styles.p}>{rich(block.text, `p${index}`)}</Text>;
  }
  if (block.kind === 'table') {
    return (
      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          {block.header.map((c, j) => (
            <Text key={`h${index}-${j}`} style={[styles.tableCell, styles.bold]}>
              {rich(c, `th${index}-${j}`)}
            </Text>
          ))}
        </View>
        {block.rows.map((row, r) => (
          <View key={`r${index}-${r}`} style={styles.tableRow}>
            {row.map((c, j) => (
              <Text key={`c${index}-${r}-${j}`} style={styles.tableCell}>
                {rich(c, `td${index}-${r}-${j}`)}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }
  return (
    <View>
      {block.items.map((item, j) => (
        <View key={`li${index}-${j}`} style={styles.bulletRow}>
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
  return (
    <Document
      title={`${DOC_TITLES[doc]} — ${tender.external_id}`}
      author={company.name}
      subject={`Tender ${tender.external_id}`}
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.letterName}>{company.name}</Text>
        <Text style={styles.letterMeta}>
          Operator economic · CUI {company.cui} · {formatDate(new Date().toISOString())} · DRAFT
        </Text>
        <Text style={styles.docTitle}>{DOC_TITLES[doc]}</Text>
        <Text style={styles.docSub}>
          Tender {tender.external_id} — {tender.state.ai_title_simplified ?? tender.title}
        </Text>
        <Text style={styles.docSub}>Autoritate contractantă: {tender.authority}</Text>
        <View style={styles.rule} />
        {parseMarkdownBlocks(markdown).map((b, bi) => (
          <BlockView key={`b${bi}`} block={b} index={bi} />
        ))}
        <Text style={styles.footerLeft} fixed>
          AI-assisted draft — review before submitting.
        </Text>
        <Text
          style={styles.footerRight}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

const DOC_FILE_LABELS: Record<DocType, string> = {
  technical: 'Technical_Offer',
  financial: 'Financial_Offer',
  duae: 'DUAE',
};

export function draftFileName(
  tender: TenderWithState,
  company: CompanyProfile,
  doc: DocType,
): string {
  const safe = (v: string) => v.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${safe(tender.external_id)}_${DOC_FILE_LABELS[doc]}_${safe(company.name)}.pdf`;
}

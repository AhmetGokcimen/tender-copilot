/**
 * Everything a bid needs in one place: the generated documents as PDFs plus the
 * company's own supporting files (certificates, balance sheets, references)
 * from its archive, and a checklist. Built in the browser; nothing is uploaded.
 */
import { strToU8, zipSync } from 'fflate';
import { documentDownloadUrl, type CompanyDocument } from './company-data';

export const safeName = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'file';

/** Saves a blob through a temporary link (kept in the page so every browser honours it). */
export function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface PackageFile {
  path: string;
  data: Uint8Array;
}

/** Downloads the company's archived files; the ones that fail are reported, not fatal. */
export async function fetchSupportFiles(
  docs: CompanyDocument[],
): Promise<{ files: PackageFile[]; failed: string[] }> {
  const files: PackageFile[] = [];
  const failed: string[] = [];
  let n = 0;
  for (const doc of docs) {
    try {
      const url = await documentDownloadUrl(doc);
      if (!url) throw new Error('no link');
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      n += 1;
      files.push({
        path: `Documente_suport/${String(n).padStart(2, '0')}_${safeName(doc.file_name)}`,
        data: new Uint8Array(await res.arrayBuffer()),
      });
    } catch {
      failed.push(doc.file_name);
    }
  }
  return { files, failed };
}

export function checklistText(input: {
  tenderId: string;
  tenderTitle: string;
  authority: string;
  company: string;
  generated: string[];
  support: string[];
  failed: string[];
  required: string[];
}): string {
  const list = (items: string[]) => (items.length > 0 ? items.map((x) => `  - ${x}`).join('\n') : '  (nimic)');
  return [
    `DOSAR DE OFERTĂ: ${input.tenderId}`,
    `${input.tenderTitle}`,
    `Autoritate contractantă: ${input.authority}`,
    `Operator economic: ${input.company}`,
    '',
    'Documente generate (proiecte de verificat):',
    list(input.generated),
    '',
    'Documente de suport din arhiva companiei:',
    list(input.support),
    ...(input.failed.length > 0 ? ['', 'Nu au putut fi descărcate (descarcă-le din arhivă):', list(input.failed)] : []),
    ...(input.required.length > 0 ? ['', 'Documente cerute de autoritate (din documentația de atribuire):', list(input.required)] : []),
    '',
    'Înainte de depunere:',
    '  - Verifică fiecare cifră și declarație față de documentația de atribuire.',
    '  - Verifică valabilitatea certificatelor la data depunerii.',
    '  - Semnează fișierele cu semnătura electronică calificată a companiei; imaginea semnăturii din PDF nu o înlocuiește.',
    '',
  ].join('\n');
}

export function zipFiles(files: PackageFile[]): Blob {
  const tree: Record<string, Uint8Array> = {};
  for (const f of files) tree[f.path] = f.data;
  const bytes = zipSync(tree, { level: 1 });
  return new Blob([bytes as BlobPart], { type: 'application/zip' });
}

export { strToU8 };

import type { ScannedDocument } from '@/lib/actions/document-scan';
import { CERTS } from '@/lib/construction';
import { newId, type CompanyData, type Contract, type Credential } from '@/lib/company-data';

const CREDENTIAL_KIND: Partial<Record<ScannedDocument['doc_type'], string>> = {
  anre_attestation: 'anre_firm',
  anre_gas: 'anre_gas',
  iscir: 'iscir',
  igsu: 'igsu',
  igpr: 'igpr',
  afer: 'afer',
  rte: 'rte',
};

/** Only the values the document actually states (nulls never overwrite). */
const present = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== '')) as Partial<T>;

/**
 * Folds what the document agent read into the profile draft: a balance
 * sheet fills that year's turnover, the trade-registry certificate adds
 * CAEN codes, an acceptance report becomes a reference contract, and
 * authorizations or ISO certificates fill (or create) a credential. The
 * user reviews every field afterwards; nothing here is saved by itself.
 */
export function applyScannedDocument(
  d: CompanyData,
  doc: ScannedDocument,
  documentId: string | null,
  target: Credential | null,
): CompanyData {
  if (doc.doc_type === 'balance_sheet' && doc.balance?.turnover != null && doc.balance.year) {
    const { year, turnover, currency } = doc.balance;
    return {
      ...d,
      turnover: [
        ...d.turnover.filter((r) => r.year !== year),
        { year, amount: turnover, currency: currency ?? 'RON', source: 'document' },
      ],
    };
  }
  if (doc.doc_type === 'company_certificate') {
    return {
      ...d,
      company: {
        ...d.company,
        caen_secondary: [...new Set([...d.company.caen_secondary, ...doc.caen_codes])].filter(
          (x) => x !== d.company.caen_main,
        ),
      },
    };
  }
  if ((doc.doc_type === 'acceptance_report' || doc.doc_type === 'reference') && doc.contract) {
    const k = doc.contract;
    const contract: Contract = {
      id: newId(),
      kind: 'works',
      title: k.title ?? doc.title ?? '',
      client: k.client,
      country: 'RO',
      trades: [],
      cpv_codes: [],
      value: k.value,
      currency: k.currency ?? 'RON',
      end_year: k.completed_on ? Number(k.completed_on.slice(0, 4)) : null,
      completion_certificate: doc.doc_type === 'acceptance_report',
      role: 'lead',
      share_pct: null,
      document_id: documentId,
    };
    return { ...d, contracts: [contract, ...d.contracts] };
  }

  const isIso = doc.doc_type === 'iso';
  const isoNo = doc.standard?.match(/(9001|14001|45001)/)?.[1];
  const kind = target?.kind ?? (isIso ? (isoNo ? `iso${isoNo}` : 'other') : (CREDENTIAL_KIND[doc.doc_type] ?? 'other'));
  const fields = present({
    type_class: isIso ? doc.standard : doc.type_class,
    number: doc.number,
    issuer: doc.issuer,
    holder: doc.holder,
    scope: doc.scope,
    issued_on: doc.issued_on,
    expires_on: doc.expires_on,
    document_id: documentId,
  });
  const existing = target
    ? d.credentials.find((x) => x.id === target.id)
    : kind !== 'other'
      ? d.credentials.find((x) => x.kind === kind)
      : undefined;
  if (existing) {
    return {
      ...d,
      credentials: d.credentials.map((x) => (x.id === existing.id ? { ...x, ...fields, source: 'document' } : x)),
    };
  }
  const created: Credential = {
    id: newId(),
    category: isIso ? 'certification' : 'authorization',
    kind,
    name: CERTS[kind]?.name ?? (isIso ? (doc.standard ?? 'ISO') : (doc.title ?? 'Document')),
    type_class: null,
    number: null,
    issuer: null,
    holder: null,
    scope: null,
    issued_on: null,
    expires_on: null,
    document_id: null,
    source: 'document',
    ...fields,
  };
  return { ...d, credentials: [...d.credentials, created] };
}

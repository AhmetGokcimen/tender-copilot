/**
 * BNR annual average EUR/RON rates, which tender documents use to convert
 * turnover and experience thresholds between currencies. Source: Banca
 * Națională a României, annual averages (verify the latest year against
 * bnr.ro before relying on it). Years not listed use the closest known one.
 */
export const BNR_EUR_RON: Record<number, number> = {
  2019: 4.7452,
  2020: 4.8371,
  2021: 4.9204,
  2022: 4.9315,
  2023: 4.9465,
  2024: 4.9746,
  // Mean of the 2025 monthly averages, as BNR computes it (financiarul.ro, Jan 2026).
  2025: 5.0415,
};

export function eurRon(year: number): { rate: number; exact: boolean } {
  if (BNR_EUR_RON[year]) return { rate: BNR_EUR_RON[year], exact: true };
  const known = Object.keys(BNR_EUR_RON).map(Number);
  const nearest = known.reduce((a, b) => (Math.abs(b - year) < Math.abs(a - year) ? b : a));
  return { rate: BNR_EUR_RON[nearest], exact: false };
}

/** RON value of an amount in RON or EUR for that year; null for other currencies. */
export function toRon(amount: number, currency: string, year: number): number | null {
  if (currency === 'RON') return amount;
  if (currency === 'EUR') return amount * eurRon(year).rate;
  return null;
}

export const COUNTIES = [
  'Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brăila', 'Brașov', 'București',
  'Buzău', 'Călărași', 'Caraș-Severin', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu',
  'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț',
  'Olt', 'Prahova', 'Sălaj', 'Satu Mare', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vâlcea',
  'Vaslui', 'Vrancea',
];

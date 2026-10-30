/**
 * County seats on the Romania dot map: position in % of the map box (a linear
 * fit of lon/lat to the same box the dot grid uses). One entry per county;
 * `Ilfov` notices sit on București. Match SEAP county names with `countyKey`,
 * which ignores case and accents ("Bucureşti", "Iasi" and "Iași" are one place).
 */
export type City = { county: string; city: string; x: number; y: number };

export const CITIES: City[] = [
  { county: 'Alba', city: 'Alba Iulia', x: 34.95, y: 47.54 },
  { county: 'Arad', city: 'Arad', x: 10.73, y: 45.09 },
  { county: 'Argeș', city: 'Pitești', x: 48.7, y: 73.8 },
  { county: 'Bacău', city: 'Bacău', x: 70.54, y: 36.88 },
  { county: 'Bihor', city: 'Oradea', x: 17.21, y: 26.54 },
  { county: 'Bistrița-Năsăud', city: 'Bistrița', x: 44.64, y: 24.61 },
  { county: 'Botoșani', city: 'Botoșani', x: 67.92, y: 11.38 },
  { county: 'Brașov', city: 'Brașov', x: 56.38, y: 56.83 },
  { county: 'Brăila', city: 'Brăila', x: 81.67, y: 64.98 },
  { county: 'București', city: 'București', x: 61.87, y: 83.07 },
  { county: 'Buzău', city: 'Buzău', x: 69.67, y: 67.46 },
  { county: 'Caraș-Severin', city: 'Reșița', x: 16.89, y: 64.21 },
  { county: 'Călărași', city: 'Călărași', x: 74.98, y: 87.95 },
  { county: 'Cluj', city: 'Cluj-Napoca', x: 35.41, y: 32.48 },
  { county: 'Constanța', city: 'Constanța', x: 88.91, y: 88.83 },
  { county: 'Covasna', city: 'Sfântu Gheorghe', x: 58.5, y: 52.03 },
  { county: 'Dâmbovița', city: 'Târgoviște', x: 54.98, y: 72.31 },
  { county: 'Dolj', city: 'Craiova', x: 37.23, y: 85.15 },
  { county: 'Galați', city: 'Galați', x: 82.21, y: 61.31 },
  { county: 'Giurgiu', city: 'Giurgiu', x: 60.45, y: 94.36 },
  { county: 'Gorj', city: 'Târgu Jiu', x: 31.68, y: 69.88 },
  { county: 'Harghita', city: 'Miercurea Ciuc', x: 58.7, y: 41.37 },
  { county: 'Hunedoara', city: 'Deva', x: 27.81, y: 51.76 },
  { county: 'Ialomița', city: 'Slobozia', x: 75.37, y: 80.1 },
  { county: 'Iași', city: 'Iași', x: 77.87, y: 24.12 },
  { county: 'Maramureș', city: 'Baia Mare', x: 34.99, y: 13.37 },
  { county: 'Mehedinți', city: 'Drobeta-Turnu Severin', x: 25.11, y: 78.54 },
  { county: 'Mureș', city: 'Târgu Mureș', x: 45.38, y: 37.5 },
  { county: 'Neamț', city: 'Piatra Neamț', x: 64.73, y: 29.1 },
  { county: 'Olt', city: 'Slatina', x: 43.31, y: 83.01 },
  { county: 'Prahova', city: 'Ploiești', x: 61.02, y: 71.96 },
  { county: 'Satu Mare', city: 'Satu Mare', x: 27.52, y: 10.43 },
  { county: 'Sălaj', city: 'Zalău', x: 29.36, y: 23.42 },
  { county: 'Sibiu', city: 'Sibiu', x: 40.76, y: 53.47 },
  { county: 'Suceava', city: 'Suceava', x: 63.5, y: 13.48 },
  { county: 'Teleorman', city: 'Alexandria', x: 53.66, y: 92.95 },
  { county: 'Timiș', city: 'Timișoara', x: 9.62, y: 54.54 },
  { county: 'Tulcea', city: 'Tulcea', x: 90.72, y: 66.84 },
  { county: 'Vaslui', city: 'Vaslui', x: 79.22, y: 35.29 },
  { county: 'Vâlcea', city: 'Râmnicu Vâlcea', x: 43.37, y: 68.55 },
  { county: 'Vrancea', city: 'Focșani', x: 73.44, y: 55.67 },
];

export function countyKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const BY_COUNTY = new Map<string, City>([
  ...CITIES.map((c): [string, City] => [countyKey(c.county), c]),
  ['ilfov', CITIES.find((c) => c.county === 'București')!],
]);

export const cityForCounty = (county: string): City | undefined => BY_COUNTY.get(countyKey(county));

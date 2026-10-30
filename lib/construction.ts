/**
 * Construction trades for onboarding: each trade lists the works a company
 * can pick (with their CPV 2008 code) and the certificates tenders in that
 * trade usually ask for. Codes are CPV 2008; certificate notes come from
 * the issuing bodies' regulations and press coverage (see `sources`).
 * Entries marked `verify` still need a check against the current official
 * text before we rely on them in eligibility checks.
 */

export type Lang = 'en' | 'ro';
type L = { en: string; ro: string };

export type Work = {
  cpv: string;
  name: L;
  /** Extra search phrases, comma-separated (both languages). */
  kw?: string;
};

export type Trade = {
  key: string;
  icon: string;
  name: L;
  works: Work[];
  certs: string[];
};

export type Cert = {
  key: string;
  name: string;
  issuer: string;
  what: L;
  verify?: boolean;
  sources: string[];
};

const w = (cpv: string, en: string, ro: string, kw?: string): Work => ({ cpv, name: { en, ro }, kw });

/** Asked for in most works tenders, whatever the trade. */
export const COMMON_CERTS = ['iso9001', 'iso14001', 'iso45001'];

export const TRADES: Trade[] = [
  {
    key: 'buildings',
    icon: 'apartment',
    name: { en: 'Buildings', ro: 'Clădiri' },
    certs: ['rte', 'isc_lab'],
    works: [
      w('45210000', 'Building construction', 'Construcții de clădiri'),
      w('45211000', 'Residential buildings', 'Clădiri de locuințe', 'blocuri de locuinte, locuinte, housing'),
      w('45211340', 'Apartment blocks', 'Blocuri de locuințe'),
      w('45212000', 'Leisure, sport, culture and hotels', 'Clădiri de agrement, sport, cultură și hoteluri'),
      w('45212300', 'Arts and cultural buildings', 'Clădiri pentru artă și cultură', 'teatru, muzeu'),
      w('45213000', 'Commercial, warehouse and transport buildings', 'Clădiri comerciale, depozite și de transport'),
      w('45214000', 'Education and research buildings', 'Clădiri pentru educație și cercetare'),
      w('45214100', 'Kindergartens', 'Grădinițe'),
      w('45214200', 'Schools', 'Școli', 'scoala, liceu'),
      w('45215000', 'Health and social care buildings', 'Clădiri de sănătate și asistență socială'),
      w('45215140', 'Hospitals', 'Spitale'),
      w('45216000', 'Police, emergency and military buildings', 'Clădiri pentru poliție, urgențe și armată'),
      w('45223500', 'Reinforced-concrete structures', 'Structuri din beton armat'),
      w('45223800', 'Prefabricated structures', 'Structuri prefabricate'),
      w('45262700', 'Building alteration', 'Modificări de clădiri'),
      w('45262800', 'Building extension', 'Extinderi de clădiri'),
      w('45453000', 'Overhaul and refurbishment', 'Reparații capitale și renovare', 'renovare, renovari'),
      w('45454000', 'Restructuring', 'Restructurare'),
    ],
  },
  {
    key: 'efficiency',
    icon: 'energy_savings_leaf',
    name: { en: 'Energy retrofit', ro: 'Eficiență energetică' },
    certs: ['rte', 'energy_auditor'],
    works: [
      w('45321000', 'Thermal insulation', 'Izolații termice', 'reabilitare termica, anvelopare, termoizolatii'),
      w('45443000', 'Façade works', 'Lucrări de fațadă'),
      w('45421130', 'Doors and windows', 'Uși și ferestre', 'tamplarie'),
      w('45261410', 'Roof insulation', 'Izolarea acoperișului'),
      w('45323000', 'Sound insulation', 'Izolații fonice'),
      w('45331100', 'Central heating', 'Încălzire centrală'),
      w('71314300', 'Energy-efficiency consultancy and audits', 'Consultanță și audit de eficiență energetică', 'audit energetic'),
    ],
  },
  {
    key: 'roads',
    icon: 'add_road',
    name: { en: 'Roads and bridges', ro: 'Drumuri și poduri' },
    certs: ['rte', 'isc_lab'],
    works: [
      w('45233100', 'Highways and roads', 'Autostrăzi și drumuri'),
      w('45233110', 'Motorways', 'Autostrăzi'),
      w('45233120', 'Road construction', 'Construcție de drumuri', 'drum judetean, drum comunal, drumuri'),
      w('45233140', 'Roadworks', 'Lucrări rutiere'),
      w('45233141', 'Road maintenance', 'Întreținere drumuri', 'deszapezire'),
      w('45233142', 'Road repair', 'Reparații drumuri'),
      w('45233222', 'Paving and asphalting', 'Pavare și asfaltare', 'asfalt, asfaltari'),
      w('45233221', 'Road markings', 'Marcaje rutiere'),
      w('45233290', 'Road signs', 'Indicatoare rutiere'),
      w('45233280', 'Road barriers', 'Parapete rutiere'),
      w('45233161', 'Footpaths and pavements', 'Trotuare și alei'),
      w('45233162', 'Cycle paths', 'Piste de biciclete'),
      w('45223300', 'Car parks', 'Parcări'),
      w('45221110', 'Bridge construction', 'Construcție de poduri'),
      w('45221119', 'Bridge renewal', 'Reabilitare poduri'),
      w('45221200', 'Tunnels, shafts and subways', 'Tuneluri, puțuri și pasaje subterane'),
      w('45316212', 'Traffic lights', 'Semafoare'),
    ],
  },
  {
    key: 'rail',
    icon: 'train',
    name: { en: 'Rail and tram', ro: 'Căi ferate și tramvai' },
    certs: ['rte', 'afer', 'isc_lab'],
    works: [
      w('45234100', 'Railway construction', 'Construcție de căi ferate'),
      w('45234110', 'Intercity railway works', 'Lucrări de cale ferată interurbană'),
      w('45234115', 'Railway signalling', 'Semnalizare feroviară'),
      w('45234116', 'Track construction', 'Construcție de linie'),
      w('45234120', 'Urban railway works', 'Lucrări de cale ferată urbană', 'metrou'),
      w('45234121', 'Tramway works', 'Linii de tramvai'),
      w('45234200', 'Cable transport systems', 'Transport pe cablu', 'telegondola, telescaun'),
    ],
  },
  {
    key: 'water',
    icon: 'water_drop',
    name: { en: 'Water and sewage', ro: 'Apă și canalizare' },
    certs: ['rte'],
    works: [
      w('45231300', 'Water and sewage pipelines', 'Conducte de apă și canalizare', 'retea de apa, retele apa canal'),
      w('45232150', 'Water distribution networks', 'Rețele de distribuție a apei', 'alimentare cu apa'),
      w('45232400', 'Sewer construction', 'Construcție de canalizare'),
      w('45232410', 'Sewerage', 'Lucrări de canalizare'),
      w('45232130', 'Storm-water drains', 'Canalizare pluvială'),
      w('45232450', 'Drainage', 'Drenaje'),
      w('45252100', 'Sewage treatment plants', 'Stații de epurare', 'statie de epurare'),
      w('45252120', 'Water treatment plants', 'Stații de tratare a apei'),
      w('45232430', 'Water treatment works', 'Lucrări de tratare a apei'),
      w('45262220', 'Water-well drilling', 'Foraje de puțuri', 'put forat, foraje puturi'),
    ],
  },
  {
    key: 'hydro',
    icon: 'waves',
    name: { en: 'Flood defence and irrigation', ro: 'Hidrotehnice și irigații' },
    certs: ['rte'],
    works: [
      w('45246000', 'River regulation and flood control', 'Regularizări de râuri și apărare împotriva inundațiilor'),
      w('45246400', 'Flood prevention', 'Prevenirea inundațiilor', 'dig, diguri'),
      w('45247000', 'Dams, canals and irrigation channels', 'Baraje, canale și canale de irigații'),
      w('45247200', 'Dams', 'Baraje'),
      w('45232120', 'Irrigation', 'Irigații'),
      w('45241000', 'Harbours', 'Porturi'),
      w('45243000', 'Coastal defence', 'Apărarea coastei'),
    ],
  },
  {
    key: 'electrical',
    icon: 'electrical_services',
    name: { en: 'Building electrics', ro: 'Instalații electrice' },
    certs: ['rte', 'anre_firm', 'anre_staff'],
    works: [
      w('45310000', 'Electrical installation', 'Instalații electrice'),
      w('45311000', 'Electrical wiring and fitting', 'Cablare și montaj electric'),
      w('45315000', 'Electrical heating and building equipment', 'Instalații electrice pentru încălzire și echipamente'),
      w('45315100', 'Electrical engineering installation', 'Instalații electrotehnice'),
      w('45317000', 'Other electrical installation', 'Alte instalații electrice'),
      w('45312310', 'Lightning protection', 'Protecție împotriva trăsnetului', 'paratrasnet'),
      w('45314300', 'Cable infrastructure', 'Infrastructură de cabluri'),
    ],
  },
  {
    key: 'power',
    icon: 'bolt',
    name: { en: 'Power networks and lighting', ro: 'Rețele electrice și iluminat' },
    certs: ['rte', 'anre_firm', 'anre_staff'],
    works: [
      w('45231400', 'Power lines', 'Linii electrice', 'LEA, LES, linii electrice'),
      w('45232200', 'Power line ancillary works', 'Lucrări auxiliare pentru linii electrice'),
      w('45232220', 'Substations', 'Posturi de transformare și stații', 'post trafo, post de transformare'),
      w('45315300', 'Electricity supply installations', 'Instalații de alimentare cu energie'),
      w('45315400', 'High-voltage installation', 'Instalații de înaltă tensiune'),
      w('45316100', 'Outdoor lighting', 'Iluminat exterior'),
      w('45316110', 'Street lighting', 'Iluminat public stradal', 'iluminat public'),
      w('45316200', 'Signalling equipment', 'Echipamente de semnalizare'),
      w('45251000', 'Power and heating plants', 'Centrale electrice și termice'),
    ],
  },
  {
    key: 'solar',
    icon: 'solar_power',
    name: { en: 'Solar and renewables', ro: 'Fotovoltaice și regenerabile' },
    certs: ['rte', 'anre_firm', 'anre_staff', 'afm_pv'],
    works: [
      w('45261215', 'Solar panels on roofs', 'Panouri solare pe acoperiș', 'fotovoltaic, panouri fotovoltaice'),
      w('09332000', 'Solar installations', 'Instalații solare'),
      w('09331200', 'Photovoltaic modules', 'Module fotovoltaice'),
      w('45251100', 'Power plants (solar parks)', 'Centrale electrice (parcuri solare)', 'parc fotovoltaic'),
      w('45315300', 'Grid connection installations', 'Instalații de racordare', 'racordare la retea, bransamente electrice'),
    ],
  },
  {
    key: 'hvac',
    icon: 'heat_pump',
    name: { en: 'Heating, cooling and plumbing', ro: 'Termice, HVAC și sanitare' },
    certs: ['rte', 'iscir', 'fgas'],
    works: [
      w('45331000', 'Heating, ventilation and air conditioning', 'Încălzire, ventilație și climatizare', 'HVAC, climatizare'),
      w('45331100', 'Central heating', 'Încălzire centrală'),
      w('45331110', 'Boilers', 'Cazane', 'centrala termica, centrale termice'),
      w('45331200', 'Ventilation and air conditioning', 'Ventilație și climatizare'),
      w('45331220', 'Air conditioning', 'Aer condiționat'),
      w('45330000', 'Plumbing and sanitary works', 'Instalații sanitare'),
      w('45332200', 'Water plumbing', 'Instalații de apă'),
      w('45332300', 'Drain laying', 'Instalații de scurgere'),
      w('45332400', 'Sanitary fixtures', 'Obiecte sanitare'),
      w('45232140', 'District heating mains', 'Rețele de termoficare', 'termoficare'),
      w('50720000', 'Central heating repair and maintenance', 'Reparații și întreținere încălzire centrală'),
    ],
  },
  {
    key: 'gas',
    icon: 'local_fire_department',
    name: { en: 'Gas', ro: 'Gaze naturale' },
    certs: ['rte', 'anre_gas'],
    works: [
      w('45333000', 'Gas fitting', 'Instalații de gaze'),
      w('45333100', 'Gas regulation equipment', 'Echipamente de reglare a gazelor'),
      w('45333200', 'Gas meters', 'Contoare de gaz'),
      w('45231220', 'Gas pipelines', 'Conducte de gaze', 'retea de gaz, retele gaze naturale'),
    ],
  },
  {
    key: 'fire',
    icon: 'fire_extinguisher',
    name: { en: 'Fire safety and security', ro: 'Securitate la incendiu și efracție' },
    certs: ['igsu', 'igpr'],
    works: [
      w('45312100', 'Fire alarm systems', 'Sisteme de detectare și alarmare la incendiu'),
      w('45343000', 'Fire prevention installations', 'Instalații de prevenire a incendiilor'),
      w('45343100', 'Fireproofing', 'Ignifugare'),
      w('45343200', 'Firefighting equipment', 'Echipamente de stingere'),
      w('45343230', 'Sprinkler systems', 'Sisteme sprinkler'),
      w('50413200', 'Firefighting equipment maintenance', 'Întreținere echipamente de stingere'),
      w('45312200', 'Burglar alarm systems', 'Sisteme de alarmă antiefracție'),
      w('32323500', 'Video surveillance', 'Supraveghere video', 'CCTV, camere video'),
    ],
  },
  {
    key: 'lifts',
    icon: 'elevator',
    name: { en: 'Lifts and escalators', ro: 'Ascensoare și scări rulante' },
    certs: ['iscir'],
    works: [
      w('45313100', 'Lift installation', 'Montaj ascensoare', 'lift, lifturi'),
      w('45313200', 'Escalator installation', 'Montaj scări rulante'),
      w('50750000', 'Lift maintenance', 'Întreținere ascensoare'),
    ],
  },
  {
    key: 'telecom',
    icon: 'cell_tower',
    name: { en: 'Telecom and data networks', ro: 'Telecomunicații și rețele de date' },
    certs: ['rte'],
    works: [
      w('45231600', 'Communication lines', 'Linii de comunicații'),
      w('45232300', 'Telephone and communication lines', 'Linii telefonice și de comunicații'),
      w('45232332', 'Telecom ancillary works', 'Lucrări auxiliare de telecomunicații'),
      w('45314000', 'Telecom equipment installation', 'Montaj echipamente de telecomunicații'),
      w('45312300', 'Antennas', 'Antene'),
      w('45314300', 'Cable infrastructure', 'Infrastructură de cabluri', 'fibra optica'),
    ],
  },
  {
    key: 'finishes',
    icon: 'format_paint',
    name: { en: 'Roofing and finishes', ro: 'Acoperișuri și finisaje' },
    certs: ['rte'],
    works: [
      w('45261000', 'Roof frames and coverings', 'Șarpante și învelitori'),
      w('45261210', 'Roof covering', 'Învelitori'),
      w('45261300', 'Flashing and guttering', 'Jgheaburi și burlane'),
      w('45261420', 'Waterproofing', 'Hidroizolații'),
      w('45261900', 'Roof repair', 'Reparații acoperiș'),
      w('45262100', 'Scaffolding', 'Schele'),
      w('45262300', 'Concrete work', 'Lucrări de betonare'),
      w('45262500', 'Masonry', 'Zidărie'),
      w('45410000', 'Plastering', 'Tencuieli'),
      w('45421000', 'Joinery', 'Tâmplărie'),
      w('45421146', 'Suspended ceilings', 'Plafoane suspendate'),
      w('45421141', 'Partitions', 'Compartimentări', 'rigips, gips carton'),
      w('45431000', 'Tiling', 'Placări cu faianță și gresie'),
      w('45432100', 'Floor laying', 'Pardoseli'),
      w('45441000', 'Glazing', 'Montaj geamuri'),
      w('45442100', 'Painting', 'Zugrăveli și vopsitorii'),
    ],
  },
  {
    key: 'site',
    icon: 'construction',
    name: { en: 'Earthworks, demolition and foundations', ro: 'Terasamente, demolări și fundații' },
    certs: ['rte', 'asbestos'],
    works: [
      w('45111000', 'Demolition and site clearance', 'Demolări și pregătirea terenului'),
      w('45111100', 'Demolition', 'Demolări'),
      w('45111300', 'Dismantling', 'Dezmembrări'),
      w('45112000', 'Excavation and earthmoving', 'Săpături și terasamente'),
      w('45112100', 'Trench digging', 'Săpături de tranșee'),
      w('45120000', 'Test drilling', 'Foraje de probă'),
      w('45262210', 'Foundations', 'Fundații'),
      w('45262211', 'Pile driving', 'Piloni', 'piloti'),
      w('45262660', 'Asbestos removal', 'Îndepărtarea azbestului'),
      w('45500000', 'Machinery hire with operator', 'Închiriere utilaje cu operator'),
    ],
  },
  {
    key: 'landscape',
    icon: 'park',
    name: { en: 'Parks, sport and outdoor', ro: 'Parcuri, sport și amenajări exterioare' },
    certs: ['rte'],
    works: [
      w('45112700', 'Landscaping', 'Amenajări peisagistice'),
      w('45112711', 'Parks', 'Parcuri'),
      w('45112723', 'Playgrounds', 'Locuri de joacă'),
      w('37535200', 'Playground equipment', 'Echipamente pentru locuri de joacă'),
      w('45236250', 'Park surfaces', 'Platforme în parcuri'),
      w('45212200', 'Sports facilities', 'Baze sportive'),
      w('45212225', 'Sports halls', 'Săli de sport'),
      w('45212212', 'Swimming pools', 'Bazine de înot'),
      w('45236100', 'Sports surfaces', 'Suprafețe pentru sport', 'gazon sintetic, terenuri de sport'),
      w('45342000', 'Fencing', 'Împrejmuiri', 'gard, garduri, imprejmuiri'),
      w('77310000', 'Green-area planting and upkeep', 'Plantare și întreținere spații verzi'),
    ],
  },
  {
    key: 'heritage',
    icon: 'account_balance',
    name: { en: 'Heritage and restoration', ro: 'Monumente și restaurare' },
    certs: ['rte', 'heritage'],
    works: [
      w('45212350', 'Historic buildings', 'Clădiri cu valoare istorică sau arhitecturală'),
      w('45212360', 'Religious buildings', 'Lăcașuri de cult', 'biserica, biserici'),
      w('45454100', 'Restoration', 'Restaurare'),
      w('45453100', 'Refurbishment', 'Renovare'),
    ],
  },
  {
    key: 'industrial',
    icon: 'factory',
    name: { en: 'Industrial and steel structures', ro: 'Industriale și structuri metalice' },
    certs: ['rte', 'en1090', 'iso3834'],
    works: [
      w('45213250', 'Industrial buildings', 'Clădiri industriale', 'hala, hale industriale'),
      w('45223100', 'Metal structure assembly', 'Montaj structuri metalice'),
      w('45223210', 'Structural steelwork', 'Structuri din oțel'),
      w('45262400', 'Steel erection', 'Montaj oțel'),
      w('45252000', 'Treatment and incineration plants', 'Stații de tratare și incinerare'),
      w('45255000', 'Oil and gas industry works', 'Lucrări pentru industria de petrol și gaze'),
      w('45259000', 'Plant repair and maintenance', 'Reparații și întreținere instalații industriale'),
      w('45351000', 'Mechanical installations', 'Instalații mecanice'),
    ],
  },
  {
    key: 'design',
    icon: 'architecture',
    name: { en: 'Design, supervision and surveying', ro: 'Proiectare, dirigenție și topografie' },
    certs: ['verifier', 'site_supervisor', 'ancpi'],
    works: [
      w('71220000', 'Architectural design', 'Proiectare arhitecturală'),
      w('71320000', 'Engineering design', 'Proiectare tehnică', 'PT, DTAC, proiectare'),
      w('71322000', 'Civil engineering design', 'Proiectare de lucrări civile'),
      w('71520000', 'Construction supervision', 'Supervizarea lucrărilor', 'diriginte, dirigentie'),
      w('71521000', 'Site supervision', 'Dirigenție de șantier'),
      w('71248000', 'Project and documentation supervision', 'Supervizarea proiectului și a documentației'),
      w('71332000', 'Geotechnical engineering', 'Studii geotehnice'),
      w('71355000', 'Surveying', 'Topografie', 'cadastru, topografie'),
    ],
  },
];

export const CERTS: Record<string, Cert> = {
  iso9001: {
    key: 'iso9001',
    name: 'ISO 9001',
    issuer: 'Organism de certificare acreditat (RENAR)',
    what: { en: 'Quality management system', ro: 'Sistem de management al calității' },
    sources: ['https://contabilul.manager.ro/a/29972/ce-certificari-iso-trebuie-sa-ceara-un-contabil-de-la-clientii-care-liciteaza-pe-seap.html'],
  },
  iso14001: {
    key: 'iso14001',
    name: 'ISO 14001',
    issuer: 'Organism de certificare acreditat (RENAR)',
    what: { en: 'Environmental management system', ro: 'Sistem de management de mediu' },
    sources: ['https://www.avocatnet.ro/forum/discutie_382110/ISO-Subcontractant.html'],
  },
  iso45001: {
    key: 'iso45001',
    name: 'ISO 45001',
    issuer: 'Organism de certificare acreditat (RENAR)',
    what: { en: 'Occupational health and safety', ro: 'Sănătate și securitate în muncă' },
    sources: ['https://contabilul.manager.ro/a/29972/ce-certificari-iso-trebuie-sa-ceara-un-contabil-de-la-clientii-care-liciteaza-pe-seap.html'],
  },
  rte: {
    key: 'rte',
    name: 'Responsabil tehnic cu execuția (RTE)',
    issuer: 'MDLPA / ISC',
    what: {
      en: 'Authorised site engineer for the works domain, required on works contracts (Law 10/1995)',
      ro: 'Responsabil tehnic autorizat pe domeniul lucrării, cerut la contractele de lucrări (Legea 10/1995)',
    },
    sources: [
      'https://legeaz.net/monitorul-oficial-767-2016/ordin-mdrap-1895-2016-procedura-autorizare-responsabili-tehnici-executie-constructii',
    ],
  },
  isc_lab: {
    key: 'isc_lab',
    name: 'Laborator autorizat ISC',
    issuer: 'ISC',
    what: {
      en: 'Authorised testing laboratory (own or contracted), often asked for road and concrete works',
      ro: 'Laborator de încercări autorizat (propriu sau contractat), cerut des la drumuri și betoane',
    },
    sources: [
      'https://edirect.e-guvernare.ro/Uploads/Legi/7456/PROCEDURA  privind evaluarea laboratoarelor de analiza si incercari in activitatea de constructii in vederea autorizarii.htm',
    ],
  },
  energy_auditor: {
    key: 'energy_auditor',
    name: 'Auditor energetic atestat',
    issuer: 'MDLPA',
    what: {
      en: 'Certified energy auditor for building energy certificates, asked on retrofit projects',
      ro: 'Auditor energetic pentru clădiri, cerut la proiectele de eficiență energetică',
    },
    verify: true,
    sources: [],
  },
  afer: {
    key: 'afer',
    name: 'Autorizație de furnizor feroviar + agrement tehnic feroviar',
    issuer: 'AFER',
    what: {
      en: 'Required for railway infrastructure design and works',
      ro: 'Obligatorie pentru proiectarea și execuția lucrărilor de infrastructură feroviară',
    },
    sources: [
      'https://cfr.ro/wp-content/uploads/2023/04/CN1054299-Anunt-de-participare.pdf',
      'https://www.puterea.ro/?p=373784',
    ],
  },
  anre_firm: {
    key: 'anre_firm',
    name: 'Atestat ANRE (tip A, B, C, D, E)',
    issuer: 'ANRE',
    what: {
      en: 'Company attestation for designing, building and checking electrical installations, by voltage level',
      ro: 'Atestat pentru proiectarea, executarea și verificarea instalațiilor electrice, pe niveluri de tensiune',
    },
    sources: [
      'https://legeaz.net/monitorul-oficial-730-2016/ordin-anre-45-2016-regulament-atestare-proiectare-executare-verificare-instalatii-electrice',
      'https://edirect.e-guvernare.ro/domeniiactivitate/SitePages/domeniideactivitatedetalii.aspx?IDC=12',
    ],
  },
  anre_staff: {
    key: 'anre_staff',
    name: 'Electricieni autorizați ANRE',
    issuer: 'ANRE',
    what: { en: 'Authorised electricians on staff', ro: 'Electricieni autorizați ANRE în echipă' },
    sources: ['https://legeaz.net/monitorul-oficial-417-2023/ordin-anre-66-2023'],
  },
  anre_gas: {
    key: 'anre_gas',
    name: 'Autorizație ANRE gaze (PDIB, EDIB, EDSB)',
    issuer: 'ANRE',
    what: {
      en: 'Gas design and execution licence; installers and PE/steel welders on staff',
      ro: 'Autorizare pentru proiectare și execuție la gaze; instalatori și sudori PE/oțel autorizați',
    },
    sources: [
      'https://www.capital.ro/noul-regulament-anre-pentru-companiile-din-domeniul-gazelor-dispar-firmele-fara-capacitate-reala-cum-se-vor-acorda-autorizatiile.html',
      'https://legeaz.net/monitorul-oficial-493-2015/ordinul-anre-98-2015/anexa-regulament',
    ],
  },
  afm_pv: {
    key: 'afm_pv',
    name: 'Instalator validat AFM',
    issuer: 'AFM',
    what: {
      en: 'Validated installer for state-funded PV programmes (needs ANRE type B)',
      ro: 'Instalator validat pentru programele de fotovoltaice finanțate de stat (cere atestat ANRE tip B)',
    },
    sources: ['https://economedia.ro/peste-500-de-instalatori-au-fost-validati-de-afm-in-programul-casa-verde-fotovoltaice.html'],
  },
  iscir: {
    key: 'iscir',
    name: 'Autorizație ISCIR',
    issuer: 'ISCIR',
    what: {
      en: 'Licence to install, repair and maintain lifts, boilers and pressure equipment',
      ro: 'Autorizare pentru montaj, reparare și întreținere ascensoare, cazane și echipamente sub presiune',
    },
    sources: ['https://legeaz.net/monitorul-oficial-399-2015/legea-64-2008-functionarea'],
  },
  fgas: {
    key: 'fgas',
    name: 'Certificat gaze fluorurate (F-gas)',
    issuer: 'Autoritatea națională desemnată (UE 2024/573)',
    what: {
      en: 'Company and technician certification for refrigerant work (air conditioning, heat pumps)',
      ro: 'Certificare firmă și personal pentru lucrul cu agenți frigorifici (climatizare, pompe de căldură)',
    },
    verify: true,
    sources: ['https://eur-lex.europa.eu/eli/reg_impl/2024/2215/oj?locale=ro'],
  },
  igsu: {
    key: 'igsu',
    name: 'Autorizație IGSU',
    issuer: 'IGSU',
    what: {
      en: 'Licence to design and install fire detection, alarm and extinguishing systems',
      ro: 'Autorizare pentru proiectarea și instalarea sistemelor de detectare, alarmare și stingere a incendiilor',
    },
    sources: [
      'https://legeaz.net/monitorul-oficial-556-2014/ordinul-mai-112-2014',
      'https://legeaz.net/monitorul-oficial-600-2015/ordinul-mai-igsu-159-ig-2015',
    ],
  },
  igpr: {
    key: 'igpr',
    name: 'Licență IGPR',
    issuer: 'IGPR',
    what: {
      en: 'Licence to design, install and maintain intruder alarm and video systems (Law 333/2003)',
      ro: 'Licență pentru proiectarea, montajul și întreținerea sistemelor antiefracție și video (Legea 333/2003)',
    },
    sources: [
      'https://legeaz.net/legea-333-2003/art-34',
      'https://alba24.ro/firmele-care-monteaza-camere-video-au-nevoie-de-licenta-de-la-sri-si-politie-o-companie-din-sebes-va-fi-cercetata-penal-1025618.html',
    ],
  },
  heritage: {
    key: 'heritage',
    name: 'Atestat Ministerul Culturii',
    issuer: 'Ministerul Culturii',
    what: {
      en: 'Certified specialists for works on listed historic monuments',
      ro: 'Specialiști atestați pentru lucrări la monumente istorice',
    },
    sources: [
      'https://e-juridic.manager.ro/articole/monitorul-oficial-nr-634-din-09-septembrie-2010-5349.html',
      'https://alba24.ro/schimbari-majore-in-legea-monumentelor-istorice-personal-atestat-si-control-al-ministerului-culturii-pentru-orice-tip-de-lucrari-1037552.html',
    ],
  },
  asbestos: {
    key: 'asbestos',
    name: 'Lucrări cu azbest (HG 1875/2005)',
    issuer: 'Inspecția Muncii (ITM)',
    what: {
      en: 'Asbestos removal under the asbestos-exposure rules; exact permit to confirm with ITM',
      ro: 'Îndepărtarea azbestului conform HG 1875/2005; documentul exact de confirmat cu ITM',
    },
    verify: true,
    sources: ['https://www.romaniatv.net/wp-content/uploads/2025/04/NF_Dir_2023.pdf'],
  },
  en1090: {
    key: 'en1090',
    name: 'SR EN 1090 (FPC)',
    issuer: 'Organism notificat',
    what: { en: 'Factory production control for steel structures', ro: 'Controlul producției pentru structuri metalice' },
    verify: true,
    sources: [],
  },
  iso3834: {
    key: 'iso3834',
    name: 'ISO 3834',
    issuer: 'Organism de certificare acreditat',
    what: { en: 'Welding quality', ro: 'Calitatea sudurii' },
    verify: true,
    sources: [],
  },
  verifier: {
    key: 'verifier',
    name: 'Verificator de proiecte atestat',
    issuer: 'MDLPA',
    what: { en: 'Certified design checker for the required fields', ro: 'Verificator de proiecte atestat pe cerințele necesare' },
    sources: ['https://legeaz.net/legea-calitatii-in-constructii-10-1995/art-24-obligatii-si-raspunderi-ale-specialistilor-verificatori-de-proiecte-ale-responsabililor-tehnici-cu-executia-si-ale-expertilor-tehnici-atestati-obligatii-si-raspunderi'],
  },
  site_supervisor: {
    key: 'site_supervisor',
    name: 'Diriginte de șantier autorizat',
    issuer: 'ISC',
    what: { en: 'Authorised site supervisor', ro: 'Diriginte de șantier autorizat' },
    verify: true,
    sources: [],
  },
  ancpi: {
    key: 'ancpi',
    name: 'Autorizație ANCPI',
    issuer: 'ANCPI',
    what: { en: 'Licence for cadastre, geodesy and surveying work', ro: 'Autorizare pentru lucrări de cadastru, geodezie și topografie' },
    sources: ['https://notari.pro/regulament-organizare-functionare-ancpi/art-10'],
  },
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export type WorkHit = { trade: Trade; work: Work };

/** Matches works by CPV prefix or by words in either language. */
export function searchWorks(query: string, limit = 30): WorkHit[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const digits = q.replace(/[^0-9]/g, '');
  const hits: WorkHit[] = [];
  const seen = new Set<string>();
  for (const trade of TRADES) {
    for (const work of trade.works) {
      if (seen.has(work.cpv)) continue;
      const text = fold(`${work.name.en} ${work.name.ro} ${work.kw ?? ''} ${trade.name.en} ${trade.name.ro}`);
      const byCode = digits.length >= 2 && work.cpv.startsWith(digits);
      if (byCode || q.split(/\s+/).every((part) => text.includes(part))) {
        hits.push({ trade, work });
        seen.add(work.cpv);
      }
    }
  }
  return hits.slice(0, limit);
}

/** Certificates suggested for the picked trades, common ones first. */
export function certsFor(tradeKeys: string[]): Cert[] {
  const keys = new Set(COMMON_CERTS);
  for (const k of tradeKeys) for (const c of TRADES.find((t) => t.key === k)?.certs ?? []) keys.add(c);
  return [...keys].map((k) => CERTS[k]).filter(Boolean);
}

export const workByCpv = (cpv: string): Work | undefined => {
  for (const t of TRADES) for (const w of t.works) if (w.cpv === cpv) return w;
  return undefined;
};

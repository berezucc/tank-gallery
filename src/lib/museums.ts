// Curated bucket list. "Visited" is NOT stored here — it's derived from whether
// any photo's location_taken matches one of `match`, so the list can never
// disagree with the actual archive. Aliases exist because photos are tagged
// with the local name ("Bảo tàng Chiến thắng B-52") while the list uses English.

export interface Museum {
  name: string;
  city: string;
  country: string;
  flag: string;
  description: string;
  /** Lowercase substrings tested against photos.location_taken. */
  match: string[];
  url?: string;
}

export interface MuseumRegion {
  region: string;
  museums: Museum[];
}

export const MUSEUMS: MuseumRegion[] = [
  {
    region: 'Europe',
    museums: [
      { name: 'The Tank Museum', city: 'Bovington', country: 'UK', flag: '\u{1F1EC}\u{1F1E7}', description: "World's largest tank collection. Home of Tiger 131 — the only running Tiger I.", match: ['tank museum', 'bovington'], url: 'https://tankmuseum.org' },
      { name: 'Musée des Blindés', city: 'Saumur', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', description: 'Second largest tank museum globally. 800+ vehicles including rare French prototypes.', match: ['blindes', 'saumur'], url: 'https://www.museedesblindes.fr' },
      { name: 'Deutsches Panzermuseum', city: 'Munster', country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', description: 'Covers German armored warfare from WWI to modern Bundeswehr.', match: ['panzermuseum', 'munster'], url: 'https://dpm-munster.de' },
      { name: 'Kubinka Tank Museum (Patriot Park)', city: 'Moscow Region', country: 'Russia', flag: '\u{1F1F7}\u{1F1FA}', description: 'Massive Soviet collection plus captured Axis vehicles. Maus prototype.', match: ['kubinka', 'patriot park'] },
      { name: 'Imperial War Museum', city: 'London', country: 'UK', flag: '\u{1F1EC}\u{1F1E7}', description: 'WWI and WWII galleries. See also IWM Duxford for aircraft + vehicles.', match: ['imperial war museum', 'duxford'], url: 'https://www.iwm.org.uk' },
      { name: 'Bastogne War Museum', city: 'Bastogne', country: 'Belgium', flag: '\u{1F1E7}\u{1F1EA}', description: 'Battle of the Bulge. Interactive WWII experience at the heart of the Ardennes.', match: ['bastogne'], url: 'https://www.bastognewarmuseum.be' },
      { name: 'Overlord Museum', city: 'Colleville-sur-Mer', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', description: 'D-Day vehicles overlooking Omaha Beach. Sherman, Panther, Hetzer.', match: ['overlord', 'colleville'] },
      { name: 'Le MM Park', city: 'Strasbourg', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', description: 'Private collection of WWII vehicles. Hands-on, walkable.', match: ['mm park'] },
      { name: "Musée de l'Armée", city: 'Paris', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', description: "Les Invalides. Napoleon's tomb + French military history spanning centuries.", match: ["musee de l'armee", 'invalides'] },
      { name: 'Museum Berlin-Karlshorst', city: 'Berlin', country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', description: 'Site of German unconditional surrender 1945. Soviet-German war focus.', match: ['karlshorst'] },
      { name: 'Sowjetisches Ehrenmal im Tiergarten', city: 'Berlin', country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', description: 'Soviet war memorial flanked by T-34 tanks in central Berlin.', match: ['sowjetisches', 'ehrenmal', 'tiergarten'] },
      { name: 'Fort de Chillon', city: 'Veytaux', country: 'Switzerland', flag: '\u{1F1E8}\u{1F1ED}', description: 'Cold War artillery fort carved into the rock beside Chillon Castle.', match: ['fort de chillon'] },
      { name: 'Museu do Combatente', city: 'Lisbon', country: 'Portugal', flag: '\u{1F1F5}\u{1F1F9}', description: 'Portuguese overseas-war collection in the Belém fortress.', match: ['museu do combatente'] },
      { name: 'Castell de Montjuïc', city: 'Barcelona', country: 'Spain', flag: '\u{1F1EA}\u{1F1F8}', description: 'Hilltop fortress and former military prison overlooking the port.', match: ['montjuic'] },
      { name: 'Hrvatski pomorski muzej', city: 'Split', country: 'Croatia', flag: '\u{1F1ED}\u{1F1F7}', description: 'Croatian maritime museum — torpedoes, naval mines, coastal defence.', match: ['pomorski'] },
      { name: 'Military History Museum', city: 'Chișinău', country: 'Moldova', flag: '\u{1F1F2}\u{1F1E9}', description: 'Outdoor Soviet-era garden on Tighina St — T-34-85, PT-76, BTR-60PB, MiG-17 and MiG-21.', match: ['chisinau'], url: 'https://www.army.md' },
      { name: 'Mostar', city: 'Mostar', country: 'Bosnia', flag: '\u{1F1E7}\u{1F1E6}', description: 'Bosnian War remnants around the rebuilt Stari Most.', match: ['mostar'] },
    ],
  },
  {
    region: 'North America',
    museums: [
      { name: 'National WWII Museum', city: 'New Orleans', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'Top-rated museum in the US. Immersive exhibits, aircraft pavilion, oral histories.', match: ['national wwii museum', 'national ww2 museum'], url: 'https://www.nationalww2museum.org' },
      { name: 'National Armor & Cavalry Museum', city: 'Fort Moore (Benning)', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'US Army armor collection. Shermans, Pattons, Abrams prototypes.', match: ['armor & cavalry', 'armor and cavalry', 'fort moore'] },
      { name: 'American Heritage Museum', city: 'Hudson, MA', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'Running WWII tanks. Tiger, Panzer IV, Sherman — many operational.', match: ['american heritage'], url: 'https://www.americanheritagemuseum.org' },
      { name: 'Intrepid Museum', city: 'New York', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'Aircraft carrier USS Intrepid + SR-71 + Space Shuttle Enterprise.', match: ['intrepid'], url: 'https://www.intrepidmuseum.org' },
      { name: 'Battleship New Jersey Museum', city: 'Camden, NJ', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: "America's most decorated battleship, berthed across from Philadelphia.", match: ['battleship new jersey'], url: 'https://www.battleshipnewjersey.org' },
      { name: 'Independence Seaport Museum', city: 'Philadelphia, PA', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'Cruiser Olympia and submarine Becuna moored at Penn’s Landing.', match: ['independence seaport'], url: 'https://www.phillyseaport.org' },
      { name: 'USS Pampanito', city: 'San Francisco, CA', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'Balao-class submarine at Fisherman’s Wharf, Pier 45.', match: ["fisherman's wharf", 'pampanito'], url: 'https://maritime.org' },
      { name: 'Battery Chamberlin', city: 'San Francisco, CA', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: '1904 six-inch disappearing gun above Baker Beach in the Presidio.', match: ['baker beach', 'battery chamberlin'] },
      { name: 'Canadian War Museum', city: 'Ottawa', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: "Canada's military history. Vehicles, art, and the regeneration hall.", match: ['canadian war museum'], url: 'https://www.warmuseum.ca' },
      { name: 'Ontario Regiment Museum', city: 'Oshawa', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'Armoured vehicles of the Ontario Regiment. Open-air collection.', match: ['ontario regiment'] },
      { name: 'Canadian Warplane Heritage Museum', city: 'Hamilton', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'Flying Lancaster bomber — one of only two airworthy in the world.', match: ['warplane heritage'], url: 'https://www.warplane.com' },
      { name: 'HMCS Haida National Historic Site', city: 'Hamilton', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'WWII Tribal-class destroyer. Most decorated ship in the Royal Canadian Navy.', match: ['haida'] },
      { name: 'CFB Borden', city: 'Borden, ON', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'Base heritage collection — Canadian armour and military vehicles.', match: ['cfb borden', 'borden'] },
      { name: 'Swords & Ploughshares Museum', city: 'Ottawa area', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'Volunteer-run collection of restored military vehicles.', match: ['swords'] },
    ],
  },
  {
    region: 'Asia & Pacific',
    museums: [
      { name: 'Yad la-Shiryon', city: 'Latrun', country: 'Israel', flag: '\u{1F1EE}\u{1F1F1}', description: 'Israeli Armored Corps museum. Hundreds of tanks in open-air displays.', match: ['yad la-shiryon', 'latrun'] },
      { name: 'JGSDF Public Information Center', city: 'Saitama', country: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', description: 'Japan Ground Self-Defense Force. Type 10, Type 90, Type 74 on display.', match: ['jgsdf'] },
      { name: 'Yushukan Museum', city: 'Tokyo', country: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', description: 'Yasukuni Shrine war museum. Zero fighter, kaiten torpedo, locomotive.', match: ['yushukan'] },
      { name: 'War Memorial of Korea', city: 'Seoul', country: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', description: 'Korean War focus. T-34, M48, K1. Outdoor displays + indoor galleries.', match: ['war memorial of korea'], url: 'https://www.warmemo.or.kr' },
      { name: 'Vietnam Military History Museum', city: 'Hanoi', country: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}', description: 'French and American war artifacts. MiGs, tanks, artillery in the courtyard.', match: ['vietnam military history', 'lich su quan su'] },
      { name: 'B-52 Victory Museum', city: 'Hanoi', country: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}', description: "Wreckage of downed B-52s. SA-2 missiles. Hanoi's air defense story.", match: ['b-52', 'chien thang b-52'] },
      { name: 'Air Defence & Air Force Museum', city: 'Hanoi', country: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}', description: 'MiG fighters, SAM launchers and radar of the North Vietnamese air defence.', match: ['phong khong', 'khong quan'] },
      { name: 'Tank & Armoured Forces Museum', city: 'Hanoi', country: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}', description: 'Armour of the People’s Army, including tanks from the fall of Saigon.', match: ['tang - thiet giap', 'thiet giap'] },
      { name: 'Dongfang Green Boat', city: 'Shanghai', country: 'China', flag: '\u{1F1E8}\u{1F1F3}', description: 'National defence education park with a large open-air military display.', match: ['东方绿舟'] },
      { name: 'Shanghai Hangyu Kepu Center', city: 'Shanghai', country: 'China', flag: '\u{1F1E8}\u{1F1F3}', description: 'Aviation science museum with retired Chinese military aircraft.', match: ['hangyu kepu'] },
      { name: 'Australian Armour & Artillery Museum', city: 'Cairns', country: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', description: 'Private collection. Running Centurion, Stuart, Matilda. Tropical setting.', match: ['australian armour', 'cairns'] },
    ],
  },
];

// Strips diacritics so "Bảo tàng Chiến thắng B-52" matches the alias "chien thang b-52".
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function matchesMuseum(museum: Museum, location: string): boolean {
  const haystack = normalize(location);
  return museum.match.some((alias) => haystack.includes(normalize(alias)));
}

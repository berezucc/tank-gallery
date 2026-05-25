export const VEHICLE_TYPES = ['tank', 'aircraft', 'artillery', 'vehicle', 'other'] as const;
export const VEHICLE_ERAS  = ['ww1', 'ww2', 'cold_war', 'modern', 'other'] as const;

export const VEHICLE_TYPE_LABELS: Record<(typeof VEHICLE_TYPES)[number], string> = {
  tank:      'Tanks',
  aircraft:  'Aircraft',
  artillery: 'Artillery',
  vehicle:   'Vehicles',
  other:     'Other',
};

export const VEHICLE_ERA_LABELS: Record<(typeof VEHICLE_ERAS)[number], string> = {
  ww1:      'WW1',
  ww2:      'WW2',
  cold_war: 'Cold War',
  modern:   'Modern',
  other:    'Other',
};

export const COMMON_NATIONS = [
  'USA',
  'USSR/Russia',
  'Germany',
  'UK',
  'Canada',
  'France',
  'Italy',
  'Japan',
] as const;

const NATION_FLAG_MAP: Record<string, string> = {
  'USA':         '\u{1F1FA}\u{1F1F8}',
  'UK':          '\u{1F1EC}\u{1F1E7}',
  'Germany':     '\u{1F1E9}\u{1F1EA}',
  'USSR/Russia': '\u{1F1F7}\u{1F1FA}',
  'Canada':      '\u{1F1E8}\u{1F1E6}',
  'France':      '\u{1F1EB}\u{1F1F7}',
  'Italy':       '\u{1F1EE}\u{1F1F9}',
  'Japan':       '\u{1F1EF}\u{1F1F5}',
  'China':       '\u{1F1E8}\u{1F1F3}',
  'South Korea': '\u{1F1F0}\u{1F1F7}',
  'Vietnam':     '\u{1F1FB}\u{1F1F3}',
  'Romania':     '\u{1F1F7}\u{1F1F4}',
  'Israel':      '\u{1F1EE}\u{1F1F1}',
  'Portugal':    '\u{1F1F5}\u{1F1F9}',
  'Spain':       '\u{1F1EA}\u{1F1F8}',
  'Croatia':     '\u{1F1ED}\u{1F1F7}',
  'Cuba':        '\u{1F1E8}\u{1F1FA}',
  'Switzerland': '\u{1F1E8}\u{1F1ED}',
  'Bosnia':      '\u{1F1E7}\u{1F1E6}',
  'Yugoslavia':  '\u{1F1F7}\u{1F1F8}',
};

// Resolves a nation string (possibly dual like "UK/USA") to flag emoji(s).
export function nationFlag(nation: string | null): string {
  if (!nation) return '';
  if (nation.includes('/')) {
    return nation
      .split('/')
      .map((n) => NATION_FLAG_MAP[n.trim()] ?? '')
      .filter(Boolean)
      .join(' ');
  }
  return NATION_FLAG_MAP[nation] ?? '';
}

export const STORAGE_BUCKET = 'photos';

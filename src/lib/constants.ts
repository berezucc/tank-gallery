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

// Common nations seen in the collection. The nation column is free-text so any value
// is allowed; this list just drives the filter pills in the UI.
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

export const STORAGE_BUCKET = 'photos';

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title:       'Museums',
  description: 'Bucket list of tank and military museums to visit.',
};

interface Museum {
  name: string;
  city: string;
  country: string;
  flag: string;
  description: string;
  visited: boolean;
  url?: string;
}

const MUSEUMS: { region: string; museums: Museum[] }[] = [
  {
    region: 'Europe',
    museums: [
      { name: 'The Tank Museum', city: 'Bovington', country: 'UK', flag: '\u{1F1EC}\u{1F1E7}', description: "World's largest tank collection. Home of Tiger 131 — the only running Tiger I.", visited: false, url: 'https://tankmuseum.org' },
      { name: 'Musée des Blindés', city: 'Saumur', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', description: "Second largest tank museum globally. 800+ vehicles including rare French prototypes.", visited: false, url: 'https://www.museedesblindes.fr' },
      { name: 'Deutsches Panzermuseum', city: 'Munster', country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', description: 'Covers German armored warfare from WWI to modern Bundeswehr.', visited: false, url: 'https://dpm-munster.de' },
      { name: 'Kubinka Tank Museum (Patriot Park)', city: 'Moscow Region', country: 'Russia', flag: '\u{1F1F7}\u{1F1FA}', description: 'Massive Soviet collection plus captured Axis vehicles. Maus prototype.', visited: false },
      { name: 'Imperial War Museum', city: 'London', country: 'UK', flag: '\u{1F1EC}\u{1F1E7}', description: 'WWI and WWII galleries. See also IWM Duxford for aircraft + vehicles.', visited: false, url: 'https://www.iwm.org.uk' },
      { name: 'Bastogne War Museum', city: 'Bastogne', country: 'Belgium', flag: '\u{1F1E7}\u{1F1EA}', description: 'Battle of the Bulge. Interactive WWII experience at the heart of the Ardennes.', visited: false, url: 'https://www.bastognewarmuseum.be' },
      { name: 'Overlord Museum', city: 'Colleville-sur-Mer', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', description: 'D-Day vehicles overlooking Omaha Beach. Sherman, Panther, Hetzer.', visited: false },
      { name: 'Le MM Park', city: 'Strasbourg', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', description: 'Private collection of WWII vehicles. Hands-on, walkable.', visited: true },
      { name: 'Musée de l\'Armée', city: 'Paris', country: 'France', flag: '\u{1F1EB}\u{1F1F7}', description: 'Les Invalides. Napoleon\'s tomb + French military history spanning centuries.', visited: true },
      { name: 'Museum Berlin-Karlshorst', city: 'Berlin', country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', description: 'Site of German unconditional surrender 1945. Soviet-German war focus.', visited: true },
      { name: 'Sowjetisches Ehrenmal im Tiergarten', city: 'Berlin', country: 'Germany', flag: '\u{1F1E9}\u{1F1EA}', description: 'Soviet war memorial flanked by T-34 tanks in central Berlin.', visited: true },
    ],
  },
  {
    region: 'North America',
    museums: [
      { name: 'National WWII Museum', city: 'New Orleans', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'Top-rated museum in the US. Immersive exhibits, aircraft pavilion, oral histories.', visited: false, url: 'https://www.nationalww2museum.org' },
      { name: 'National Armor & Cavalry Museum', city: 'Fort Moore (Benning)', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'US Army armor collection. Shermans, Pattons, Abrams prototypes.', visited: false },
      { name: 'American Heritage Museum', city: 'Hudson, MA', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'Running WWII tanks. Tiger, Panzer IV, Sherman — many operational.', visited: false, url: 'https://www.americanheritagemuseum.org' },
      { name: 'Intrepid Museum', city: 'New York', country: 'USA', flag: '\u{1F1FA}\u{1F1F8}', description: 'Aircraft carrier USS Intrepid + SR-71 + Space Shuttle Enterprise.', visited: true, url: 'https://www.intrepidmuseum.org' },
      { name: 'Canadian War Museum', city: 'Ottawa', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'Canada\'s military history. Vehicles, art, and the regeneration hall.', visited: true, url: 'https://www.warmuseum.ca' },
      { name: 'Ontario Regiment Museum', city: 'Oshawa', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'Armoured vehicles of the Ontario Regiment. Open-air collection.', visited: true },
      { name: 'Canadian Warplane Heritage Museum', city: 'Hamilton', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'Flying Lancaster bomber — one of only two airworthy in the world.', visited: true, url: 'https://www.warplane.com' },
      { name: 'HMCS Haida National Historic Site', city: 'Hamilton', country: 'Canada', flag: '\u{1F1E8}\u{1F1E6}', description: 'WWII Tribal-class destroyer. Most decorated ship in the Royal Canadian Navy.', visited: true },
    ],
  },
  {
    region: 'Asia & Pacific',
    museums: [
      { name: 'Yad la-Shiryon', city: 'Latrun', country: 'Israel', flag: '\u{1F1EE}\u{1F1F1}', description: 'Israeli Armored Corps museum. Hundreds of tanks in open-air displays. Captured Arab vehicles.', visited: false },
      { name: 'JGSDF Public Information Center', city: 'Saitama', country: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', description: 'Japan Ground Self-Defense Force. Type 10, Type 90, Type 74 on display.', visited: true },
      { name: 'Yushukan Museum', city: 'Tokyo', country: 'Japan', flag: '\u{1F1EF}\u{1F1F5}', description: 'Yasukuni Shrine war museum. Zero fighter, kaiten torpedo, locomotive.', visited: true },
      { name: 'War Memorial of Korea', city: 'Seoul', country: 'South Korea', flag: '\u{1F1F0}\u{1F1F7}', description: 'Korean War focus. T-34, M48, K1. Outdoor displays + indoor galleries.', visited: true, url: 'https://www.warmemo.or.kr' },
      { name: 'Vietnam Military History Museum', city: 'Hanoi', country: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}', description: 'French and American war artifacts. MiGs, tanks, artillery in the courtyard.', visited: true },
      { name: 'B-52 Victory Museum', city: 'Hanoi', country: 'Vietnam', flag: '\u{1F1FB}\u{1F1F3}', description: 'Wreckage of downed B-52s. SA-2 missiles. Hanoi\'s air defense story.', visited: true },
      { name: 'Australian Armour & Artillery Museum', city: 'Cairns', country: 'Australia', flag: '\u{1F1E6}\u{1F1FA}', description: 'Private collection. Running Centurion, Stuart, Matilda. Tropical setting.', visited: false },
    ],
  },
];

export default function MuseumsPage() {
  const totalVisited = MUSEUMS.flatMap((r) => r.museums).filter((m) => m.visited).length;
  const total = MUSEUMS.flatMap((r) => r.museums).length;

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Museums</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {totalVisited} of {total} visited
          </p>
        </div>
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-100">&larr; Gallery</Link>
      </div>

      {MUSEUMS.map((region) => (
        <section key={region.region} className="mb-10">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-zinc-500">
            {region.region}
          </h2>
          <div className="space-y-1">
            {region.museums.map((m) => (
              <div
                key={m.name}
                className={
                  'group rounded-lg border px-4 py-3 transition-colors ' +
                  (m.visited
                    ? 'border-zinc-800/50 bg-zinc-900/30'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {m.visited && (
                        <span className="flex-shrink-0 text-emerald-500" title="Visited">&#10003;</span>
                      )}
                      <h3 className="text-sm font-medium text-zinc-100">
                        {m.flag} {m.name}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {m.city}, {m.country}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                      {m.description}
                    </p>
                  </div>
                  {m.url && (
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-xs text-zinc-600 transition-colors hover:text-zinc-300"
                    >
                      &nearr;
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <p className="text-xs text-zinc-600">
        Know a museum that should be on this list? Add it to the code.
      </p>
    </main>
  );
}

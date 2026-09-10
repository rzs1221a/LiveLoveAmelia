/* Island data — shared by the map, compare tool, listings, affordability and the island book. */

/* Attribute scores are 1–5 and describe amenities, home stock and price level only.
   Confirm with Kelly before launch. */
export const PLACES = {
  fort: {
    k: 'North tip', h: 'Fort Clinch & the north end', short: 'Fort Clinch & north end',
    p: 'Maritime forest, a Civil War fort, and the quietest beaches on the island. Homes here trade ocean noise for oak canopy and a five-minute bike to downtown.',
    f: ['State park', 'Bike trails', 'Old-Florida lots'],
    s: { walk: 3, beach: 4, newness: 2, space: 4, price: 3 },
    styles: ['Old-Florida cottages', 'Mid-century ranches', 'Wooded lots'],
    ask: 'What is it like living near Fort Clinch on the north end of Amelia Island?',
  },
  historic: {
    k: 'Downtown charm', h: 'Fernandina Beach Historic District', short: 'Historic District',
    p: 'Fifty blocks of Victorian porches around Centre Street. Shrimp boats at the marina, brunch on foot, and the kind of neighbors who wave. Older homes, more character, more upkeep.',
    f: ['Walkable', 'Victorian', 'Marina'],
    s: { walk: 5, beach: 3, newness: 1, space: 2, price: 3 },
    styles: ['Victorian', 'Craftsman bungalows', 'Restored cottages'],
    ask: "I love historic homes. What's it like to live in Fernandina Beach's Historic District?",
  },
  north: {
    k: 'Beach life', h: 'North Beach & Main Beach', short: 'North & Main Beach',
    p: "The island's everyday beach — Main Beach Park, the boardwalk, and streets of cottages and newer builds a block or two off the sand.",
    f: ['Beach blocks', 'Cottages', 'Boardwalk'],
    s: { walk: 4, beach: 5, newness: 3, space: 2, price: 3 },
    styles: ['Beach cottages', 'Newer builds', 'Condos'],
    ask: 'What are the beach neighborhoods near Main Beach and North Beach like on Amelia Island?',
  },
  crane: {
    k: 'New construction', h: 'Crane Island', short: 'Crane Island',
    p: 'A brand-new island village on the Amelia River — coastal cottages with porches, boardwalks, and a community dock. Still choosing finishes on many homes.',
    f: ['New build', 'Intracoastal', 'Dock'],
    s: { walk: 2, beach: 2, newness: 5, space: 3, price: 4 },
    styles: ['New coastal cottages', 'Porch homes', 'Marsh-view lots'],
    ask: "What is Crane Island like? I'm interested in new construction on Amelia Island.",
  },
  yulee: {
    k: 'Mainland value', h: 'Yulee', short: 'Yulee',
    p: 'Ten minutes over the bridge: newer subdivisions, bigger lots, A-rated schools, and the island still in your weekend. Where many first homes and family moves land.',
    f: ['More house', 'Schools', 'Newer'],
    s: { walk: 2, beach: 1, newness: 4, space: 5, price: 1 },
    styles: ['Newer subdivisions', 'Larger lots', 'Builder homes'],
    ask: 'We want more house for the money and good schools. Should we look at Yulee instead of the island?',
  },
  south: {
    k: 'Oceanfront luxury', h: 'South End & the Ritz-Carlton', short: 'South End & the Ritz',
    p: 'Dune-front estates and resort condos on the quietest stretch of sand, with the Ritz as your neighbor and the Plantation next door.',
    f: ['Oceanfront', 'Resort', 'Estates'],
    s: { walk: 1, beach: 5, newness: 3, space: 3, price: 5 },
    styles: ['Oceanfront estates', 'Resort condos', 'Dune-front lots'],
    ask: "What's the South End of Amelia Island near the Ritz-Carlton like for a luxury beach home?",
  },
  plantation: {
    k: 'The resort', h: 'Amelia Island Plantation', short: 'The Plantation',
    p: 'Gated, oak-canopied, ocean and marsh views, golf and tennis and the Omni at your doorstep. Second homes and forever homes alike.',
    f: ['Gated', 'Golf', 'Marsh & ocean'],
    s: { walk: 2, beach: 4, newness: 2, space: 4, price: 4 },
    styles: ['Villas', 'Condos', 'Estate homes', 'Golf-view'],
    ask: 'Tell me about living in Amelia Island Plantation — who it suits, what homes there are like, and what I should know before buying.',
  },
};

export const AXES = [
  ['walk', 'Walkability'],
  ['beach', 'Beach access'],
  ['newness', 'Newer housing'],
  ['space', 'Privacy & space'],
  ['price', 'Price level'],
];

export const MATCH_TO_SPOT = { 'plantation': 'plantation', 'crane': 'crane', 'historic': 'historic', 'fort clinch': 'fort', 'north beach': 'north', 'south end': 'south', 'ritz': 'south', 'yulee': 'yulee', 'callahan': 'yulee', 'hilliard': 'yulee', 'bryceville': 'yulee' };

export const LISTINGS = [
  { price: 2225000, area: 'Fernandina Beach', type: 'Single Family', bd: 3, ba: 3.5, sf: 3061, tag: 'Oceanfront' },
  { price: 1980000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3.5, sf: 3901, tag: 'Just listed' },
  { price: 1997000, area: 'Fernandina Beach', type: 'Condominium', bd: 3, ba: 3.5, sf: 2180, tag: 'Ocean view' },
  { price: 1295000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 3234, tag: 'Just listed' },
  { price: 860000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 2690, tag: 'Just listed' },
  { price: 699900, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 2836, tag: 'Just listed' },
];

/* Price bands → where that money usually lands. General guidance, not a valuation. */
export const BANDS = [
  { lo: 0, hi: 500000, label: 'Under $500K', areas: ['Yulee & the mainland', 'Island condos and townhomes'], note: 'Rarely a single-family home on the island itself.' },
  { lo: 500000, hi: 900000, label: '$500K – $900K', areas: ['Historic District cottages', 'North Beach blocks', 'Newer Yulee builds'], note: 'The widest choice on the island.' },
  { lo: 900000, hi: 1500000, label: '$900K – $1.5M', areas: ['Amelia Island Plantation', 'Crane Island', 'Larger historic homes'], note: 'Golf, marsh and river views come into range.' },
  { lo: 1500000, hi: Infinity, label: '$1.5M+', areas: ['Oceanfront', 'South End near the Ritz-Carlton', 'Estate homes'], note: 'Dune-front and estate territory.' },
];

/* Kelly's Island Book — every venue and event must be confirmed by Kelly before launch. */
export const BOOK = [
  { cat: 'beaches', name: 'Main Beach', blurb: 'The island’s front porch — boardwalk, volleyball, ice cream, and the easiest parking on the island.', ask: 'Tell me about the Main Beach area of Amelia Island and the neighborhoods around it.' },
  { cat: 'beaches', name: 'Fort Clinch State Park', blurb: 'Maritime forest, a Civil War fort, a fishing pier, and the quietest sand on the north end.', ask: 'What is living near Fort Clinch State Park like?' },
  { cat: 'beaches', name: 'Peters Point', blurb: 'Wide, low-key beach park on the south end with pavilions and room to spread out.', ask: 'What are the neighborhoods near Peters Point on the south end like?' },
  { cat: 'beaches', name: 'American Beach', blurb: 'A landmark stretch of the island’s history, with NaNa — the tallest dune in Florida — behind it.', ask: 'Tell me about American Beach and the homes around it.' },
  { cat: 'eats', name: 'Salt', blurb: 'The Ritz-Carlton’s coastal fine-dining room. Special-occasion territory, right on the dunes.', ask: 'What is the south end near the Ritz-Carlton like to live in?' },
  { cat: 'eats', name: "Timoti's Seafood Shak", blurb: 'Counter-service wild-caught shrimp and fish tacos, a block off Centre Street.', ask: 'What is the walkable downtown Fernandina lifestyle actually like day to day?' },
  { cat: 'eats', name: 'Burlingame', blurb: 'Chef-driven small plates downtown — the reservation locals make when family visits.', ask: 'How walkable is the Historic District to restaurants and the marina?' },
  { cat: 'eats', name: 'España', blurb: 'Spanish and Portuguese cooking tucked into a downtown cottage. Paella and sangria weather.', ask: 'What kinds of homes are within walking distance of downtown Fernandina restaurants?' },
  { cat: 'eats', name: 'The Salty Pelican', blurb: 'Rooftop views over the marina and the shrimp boats. Sunset drinks with a water view.', ask: 'Tell me about living near the Fernandina Beach marina.' },
  { cat: 'eats', name: 'Beech Street Grill', blurb: 'A long-standing island dining room in a historic house, a few blocks off Centre.', ask: 'What should I know about buying an older historic home in Fernandina Beach?' },
  { cat: 'rituals', name: 'Isle of Eight Flags Shrimp Festival', when: 'Spring', blurb: 'The island’s biggest weekend: art, pirates, parades and shrimp on every corner downtown.', ask: 'What is springtime like on Amelia Island — festivals, crowds, weather?' },
  { cat: 'rituals', name: "Concours d'Elegance", when: 'Spring', blurb: 'Rare cars on the fairways at the south end, drawing collectors from all over the world.', ask: 'How does the resort side of the island feel during big events?' },
  { cat: 'rituals', name: 'Dickens on Centre', when: 'December', blurb: 'Downtown goes Victorian for the holidays — carolers, lights, and Centre Street closed to cars.', ask: 'What are the winter months like on Amelia Island?' },
  { cat: 'rituals', name: 'Sounds on Centre', when: 'Seasonal', blurb: 'Free live music in the street downtown, lawn chairs encouraged.', ask: 'How social is downtown Fernandina Beach for newcomers?' },
  { cat: 'rituals', name: 'The shrimp boats', blurb: 'Fernandina is the birthplace of the modern shrimping industry. The fleet still works the river.', ask: 'Tell me about the working waterfront in Fernandina Beach.' },
  { cat: 'nature', name: 'Egans Creek Greenway', blurb: 'Three hundred acres of salt marsh trails in the middle of town. Alligators, herons, no traffic.', ask: 'Which neighborhoods back up to Egans Creek Greenway?' },
  { cat: 'nature', name: 'Amelia River Cruises', blurb: 'Dolphins, Cumberland Island, and the best way to see the island from the water.', ask: 'What should I know about waterfront and dock access on Amelia Island?' },
  { cat: 'nature', name: 'Kayaking Lofton Creek', blurb: 'Blackwater paddling under oaks on the mainland side — the calm counterpart to the ocean.', ask: 'Tell me about the mainland side of Nassau County for someone who loves the water.' },
];

export const BOOK_CATS = [['all', 'All'], ['beaches', 'Beaches'], ['eats', 'Eats'], ['rituals', 'Rituals'], ['nature', 'Nature']];

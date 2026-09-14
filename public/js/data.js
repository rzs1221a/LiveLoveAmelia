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

export const MATCH_TO_SPOT = { 'plantation': 'plantation', 'crane': 'crane', 'historic': 'historic', 'fort clinch': 'fort', 'north beach': 'north', 'south end': 'south', 'ritz': 'south', 'yulee': 'yulee', 'callahan': 'yulee', 'hilliard': 'yulee', 'bryceville': 'yulee' };

export const LISTINGS = [
  { price: 2225000, area: 'Fernandina Beach', type: 'Single Family', bd: 3, ba: 3.5, sf: 3061, tag: 'Oceanfront' },
  { price: 1980000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3.5, sf: 3901, tag: 'Just listed' },
  { price: 1997000, area: 'Fernandina Beach', type: 'Condominium', bd: 3, ba: 3.5, sf: 2180, tag: 'Ocean view' },
  { price: 1295000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 3234, tag: 'Just listed' },
  { price: 860000, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 2690, tag: 'Just listed' },
  { price: 699900, area: 'Fernandina Beach', type: 'Single Family', bd: 4, ba: 3, sf: 2836, tag: 'Just listed' },
];

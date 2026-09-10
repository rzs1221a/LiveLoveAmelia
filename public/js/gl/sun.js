/* Where the sun and moon actually are, computed locally. No network, no key.
 *
 * Right ascension + GMST rather than the older equation-of-time route: it is
 * both shorter and more accurate, and it yields the equation of time for free.
 * The series is the Astronomical Almanac low-precision one, good to ~0.01°
 * from 1950 to 2050 — several hundred times better than a decorative sky
 * needs, and short enough to read in one sitting. */

const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const mod = (x, m) => ((x % m) + m) % m;
const wrap180 = x => mod(x + 180, 360) - 180;
const sin = d => Math.sin(d * D2R), cos = d => Math.cos(d * D2R), tan = d => Math.tan(d * D2R);

export const AMELIA_LAT = 30.67;

/* Atmospheric refraction (Bennett 1982). Skipping this is a ~0.57° error at
 * the horizon — fifty times the series error, and enough to put sunrise three
 * minutes late. It is one line; there is no excuse for leaving it out. */
function refract(alt) {
  if (alt < -1) return alt;
  return alt + (1 / tan(alt + 7.31 / (alt + 4.4))) / 60;
}

/* Equatorial to horizontal, shared by both bodies. */
function horizontal(ra, dec, lmstDeg, lat) {
  const H = wrap180(lmstDeg - ra);
  const alt = Math.asin(sin(dec) * sin(lat) + cos(dec) * cos(H) * cos(lat)) * R2D;
  const az = mod(Math.atan2(-cos(dec) * sin(H), sin(dec) * cos(lat) - cos(dec) * cos(H) * sin(lat)) * R2D, 360);
  return { alt: refract(alt), az, H };
}

/* The longitude is a product decision, not an astronomical one.
 *
 * Feeding Amelia's real longitude is the honest answer, but it hands a visitor
 * in London at 3pm a black midnight hero — and that is exactly when a European
 * lead lands on a coastal-Florida listing site. Deriving longitude from the
 * visitor's own timezone gives everyone their own time of day, while
 * declination still comes from the real date, so the seasons stay true:
 * Amelia's high summer sun in July, its low winter sun in January. */
export function visitorLongitude(date = new Date()) {
  return -date.getTimezoneOffset() / 4;
}

export function almanac(date = new Date(), lat = AMELIA_LAT, lon = visitorLongitude(date)) {
  const JD = date.getTime() / 86400000 + 2440587.5;
  const n = JD - 2451545.0;                       /* days from J2000.0 */

  /* Sun */
  const L = mod(280.460 + 0.9856474 * n, 360);    /* mean longitude */
  const g = mod(357.528 + 0.9856003 * n, 360);    /* mean anomaly */
  const lam = L + 1.915 * sin(g) + 0.020 * sin(2 * g);
  const eps = 23.439 - 0.0000004 * n;
  const sunRA = mod(Math.atan2(cos(eps) * sin(lam), cos(lam)) * R2D, 360);
  const sunDec = Math.asin(sin(eps) * sin(lam)) * R2D;

  const gmstH = mod(18.697374558 + 24.06570982441908 * n, 24);
  const lmst = mod((gmstH + lon / 15) * 15, 360);

  const sun = horizontal(sunRA, sunDec, lmst, lat);

  /* Moon — Meeus low-precision, three terms. ~0.3°, which is well inside the
   * "nobody will overlay a photograph of the real sky" budget. */
  const Lm = mod(218.316 + 13.176396 * n, 360);
  const Mm = mod(134.963 + 13.064993 * n, 360);
  const F  = mod(93.272 + 13.229350 * n, 360);
  const D  = mod(297.850 + 12.190749 * n, 360);
  const lamM = Lm + 6.289 * sin(Mm) + 1.274 * sin(2 * D - Mm) + 0.658 * sin(2 * D)
             + 0.214 * sin(2 * Mm) - 0.186 * sin(g) - 0.114 * sin(2 * F);
  const betM = 5.128 * sin(F);
  const moonRA = mod(Math.atan2(sin(lamM) * cos(eps) - tan(betM) * sin(eps), cos(lamM)) * R2D, 360);
  const moonDec = Math.asin(sin(betM) * cos(eps) + cos(betM) * sin(eps) * sin(lamM)) * R2D;
  const moon = horizontal(moonRA, moonDec, lmst, lat);

  /* Illuminated fraction from true elongation, which costs nothing extra now
   * that both positions are in hand. */
  const psi = Math.acos(sin(sunDec) * sin(moonDec) + cos(sunDec) * cos(moonDec) * cos(sunRA - moonRA)) * R2D;
  const illum = (1 - cos(psi)) / 2;
  const age = mod(JD - 2451550.1, 29.530588853);

  return {
    sun: { ...sun, ra: sunRA, dec: sunDec },
    moon: { ...moon, ra: moonRA, dec: moonDec, illum, waxing: age < 14.765 },
    lmst,
    eotMinutes: 4 * wrap180(L - 0.0057183 - sunRA),
  };
}

/* The hero looks east over the Atlantic — true to the island, and the reason
 * the sun genuinely rises out of the water here. It follows that the disc is
 * only in frame from roughly azimuth 45° to 135°; for the rest of the day the
 * sky is still driven entirely by elevation, with the sunset glowing from
 * behind the viewer over the marsh. That is correct for Amelia, not a
 * limitation to work around. */
export const CAMERA_YAW = 90, HFOV = 90, VFOV = 60;

export function project(az, alt, horizon = 0.6) {
  return {
    x: 0.5 + wrap180(az - CAMERA_YAW) / HFOV,
    y: horizon + alt / VFOV,
    /* Fades the disc out rather than clipping it at the frame edge. */
    inFrame: Math.max(0, 1 - Math.abs(wrap180(az - CAMERA_YAW)) / (HFOV * 0.62)),
  };
}

/* Twilight, keyed on solar elevation. This ramp is where the whole effect
 * lives — the disc is a detail, the light is the point. */
export function daylight(alt) {
  return {
    day:    Math.min(1, Math.max(0, (alt - 0) / 10)),
    golden: Math.max(0, 1 - Math.abs(alt - 3) / 9),
    civil:  Math.max(0, Math.min(1, (alt + 6) / 6)) * Math.max(0, Math.min(1, (2 - alt) / 4)),
    night:  Math.min(1, Math.max(0, (-alt - 6) / 12)),
  };
}

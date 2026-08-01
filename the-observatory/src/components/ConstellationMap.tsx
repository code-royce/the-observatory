import type { ConstellationStar } from './types';
import { CONSTELLATION_LINES } from './constellationLines';

/**
 * @param stars  the constellation's stars, brightest first
 * @param label  constellation name, used to look up its figure lines
 */
interface ConstellationMapProps {
  stars: ConstellationStar[];
  label: string;
}

// Drawing box in SVG user units. The viewBox scales to whatever width the
// card gives it, so these are proportions rather than pixels.
const WIDTH = 320;
const HEIGHT = 220;
const PADDING = 20;

/**
 * Turns a magnitude into a dot radius. Lower magnitude is brighter, so the
 * scale is inverted: Betelgeuse at 0.45 is a fat dot, a 4.4 star a speck.
 */
function radiusFor(magnitude: number): number {
  const r = 4.6 - magnitude * 0.85;
  return Math.max(0.9, Math.min(5, r));
}

/**
 * Right ascension is stored in hours; the figure lines use degrees running
 * -180..180. Converting the stars puts both in one coordinate space.
 */
function raToDegrees(hours: number): number {
  const degrees = hours * 15;
  return degrees > 180 ? degrees - 360 : degrees;
}

/**
 * Plots a constellation from its real coordinates, with the traditional
 * figure drawn behind the stars.
 */
export function ConstellationMap({ stars, label }: ConstellationMapProps) {
  if (stars.length === 0) return null;

  const segments = CONSTELLATION_LINES[label] ?? [];

  const starPoints = stars.map((star) => ({
    star,
    ra: raToDegrees(star.RightAscension),
    dec: star.Declination,
  }));

  // Bounds cover the lines too. Only the brightest stars are sent, so a
  // figure can reach past them and would otherwise be clipped.
  const allRa = [
    ...starPoints.map((p) => p.ra),
    ...segments.flat().map(([ra]) => ra),
  ];
  const allDec = [
    ...starPoints.map((p) => p.dec),
    ...segments.flat().map(([, dec]) => dec),
  ];

  // The -180..180 seam falls at 12h, so constellations near it (Virgo, Corvus,
  // Ursa Major) have points at both ends. Lifting the negatives past 180
  // makes them contiguous again.
  const wraps = Math.max(...allRa) - Math.min(...allRa) > 180;
  const unwrap = (ra: number) => (wraps && ra < 0 ? ra + 360 : ra);

  const raValues = allRa.map(unwrap);
  const minRa = Math.min(...raValues);
  const maxRa = Math.max(...raValues);
  const minDec = Math.min(...allDec);
  const maxDec = Math.max(...allDec);

  // Degrees of sky covered, narrowed by the cosine of the declination because
  // meridians converge at the poles.
  const midDec = ((minDec + maxDec) / 2) * (Math.PI / 180);
  const spanX = Math.max(0.5, (maxRa - minRa) * Math.cos(midDec));
  const spanY = Math.max(0.5, maxDec - minDec);

  // One scale for both axes keeps the shape true; the tighter axis decides.
  const scale = Math.min(
    (WIDTH - PADDING * 2) / spanX,
    (HEIGHT - PADDING * 2) / spanY,
  );
  const offsetX = (WIDTH - spanX * scale) / 2;
  const offsetY = (HEIGHT - spanY * scale) / 2;

  // Right ascension increases eastward, which is leftward on a sky chart, and
  // higher declination is higher in the sky but lower in SVG y. Both flip.
  const projectX = (ra: number) =>
    offsetX + (maxRa - unwrap(ra)) * Math.cos(midDec) * scale;
  const projectY = (dec: number) => offsetY + (maxDec - dec) * scale;

  const visibleCount = stars.filter((s) => s.Visible).length;

  return (
    // The wrapper owns the width. A bare svg is a flex child in the card body
    // and gets shrunk to nothing.
    <div className="w-full max-w-md">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto block rounded-lg bg-base-300/50"
        role="img"
        aria-label={
          `Star map of ${label}: ${stars.length} stars, ` +
          `${visibleCount} bright enough to see from this location.`
        }
      >
        {segments.map((segment, i) => (
          <polyline
            key={i}
            points={segment.map(
              ([ra, dec]) => `${projectX(ra)},${projectY(dec)}`
            ).join(' ')}
            className="fill-none stroke-base-content/25"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {starPoints.map(({ star, ra, dec }) => (
          <circle
            key={`${star.Name ?? 'star'}-${star.RightAscension}-${star.Declination}`}
            cx={projectX(ra)}
            cy={projectY(dec)}
            r={radiusFor(star.Magnitude)}
            // Washed out by light pollution: drawn, but barely.
            className={star.Visible ? 'fill-warning' : 'fill-base-content/20'}
          >
            <title>
              {`${star.Name?.trim() || 'unnamed'} — magnitude ${star.Magnitude}`}
              {star.Visible ? '' : ' (too faint to see here)'}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

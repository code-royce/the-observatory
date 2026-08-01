import type { ConstellationStar } from './types';

/**
 * @param stars  the constellation's stars, brightest first
 * @param label  constellation name, used for the accessible description
 */
interface ConstellationMapProps {
  stars: ConstellationStar[];
  label: string;
}

// Drawing box in SVG user units. The viewBox scales to whatever width the
// card gives it, so these are proportions rather than pixels.
const WIDTH = 320;
const HEIGHT = 220;
const PADDING = 24;

/**
 * Turns a magnitude into a dot radius. Lower magnitude is brighter, so the
 * scale is inverted: Betelgeuse at 0.45 is a fat dot, a 4.4 star a speck.
 */
function radiusFor(magnitude: number): number {
  const r = 4.6 - magnitude * 0.85;
  return Math.max(0.9, Math.min(5, r));
}

/**
 * Plots a constellation's stars from their real coordinates.
 *
 * Right ascension is stored in hours (0-24), not degrees, which is why it is
 * multiplied by 15 here and in the backend's altitude maths. RA also runs
 * east, which on a sky chart is leftward, so the x axis is flipped.
 */
export function ConstellationMap({ stars, label }: ConstellationMapProps) {
  if (stars.length === 0) return null;

  // Constellations spanning RA 0h (Pegasus, Cassiopeia, Andromeda) have stars
  // at both 23.9 and 0.1, which would plot at opposite edges. Shifting the
  // low side past 24 puts them back together.
  const rightAscensions = stars.map((s) => s.RightAscension);
  const wraps = Math.max(...rightAscensions) - Math.min(...rightAscensions) > 12;
  const points = stars.map((s) => ({
    star: s,
    ra: wraps && s.RightAscension < 12 ? s.RightAscension + 24 : s.RightAscension,
    dec: s.Declination,
  }));

  const raValues = points.map((p) => p.ra);
  const decValues = points.map((p) => p.dec);
  const minRa = Math.min(...raValues);
  const maxRa = Math.max(...raValues);
  const minDec = Math.min(...decValues);
  const maxDec = Math.max(...decValues);

  // Degrees of sky covered. RA hours become degrees at 15 per hour, narrowed
  // by the cosine of the declination because meridians converge at the poles.
  const midDec = ((minDec + maxDec) / 2) * (Math.PI / 180);
  const spanX = Math.max(0.5, (maxRa - minRa) * 15 * Math.cos(midDec));
  const spanY = Math.max(0.5, maxDec - minDec);

  // One scale for both axes keeps the shape true; the tighter axis decides.
  const scale = Math.min(
    (WIDTH - PADDING * 2) / spanX,
    (HEIGHT - PADDING * 2) / spanY,
  );
  const offsetX = (WIDTH - spanX * scale) / 2;
  const offsetY = (HEIGHT - spanY * scale) / 2;

  const placed = points.map((p) => ({
    star: p.star,
    // Flipped: RA increases eastward, which is leftward on a sky chart.
    x: offsetX + (maxRa - p.ra) * 15 * Math.cos(midDec) * scale,
    // Flipped: higher declination is higher in the sky, lower in SVG y.
    y: offsetY + (maxDec - p.dec) * scale,
  }));

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
      {placed.map(({ star, x, y }) => (
        <circle
          key={`${star.Name ?? 'star'}-${star.RightAscension}-${star.Declination}`}
          cx={x}
          cy={y}
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

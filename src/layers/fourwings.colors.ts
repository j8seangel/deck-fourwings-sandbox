export const COLOR_RAMP_DEFAULT_NUM_STEPS = 10;
const EMPTY_RGBA_COLOR = { r: 0, g: 0, b: 0, a: 0 };

const rgbaStringToObject = (rgba?: string) => {
  if (!rgba) return EMPTY_RGBA_COLOR;
  const startIndex = rgba.startsWith('rgb') ? 4 : 0;
  const colorHasAlpha = rgba.includes('rgba');
  const [r, g, b, a] = rgba
    .substring(startIndex + (colorHasAlpha ? 1 : 0), rgba.length - 1)
    .replace(/ /g, '')
    .split(',');

  return {
    r: parseInt(r),
    g: parseInt(g),
    b: parseInt(b),
    a: colorHasAlpha ? parseFloat(a) : 1,
  };
};
const hexToRgb = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  const color = {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16),
  };
  return color;
};

const rgbToRgbString = ({ r, g, b }: { r: number; g: number; b: number }) => {
  return `${r}, ${g}, ${b}`;
};

const hexToRgbString = (hex: string) => {
  const color = hexToRgb(hex);
  return rgbToRgbString(color);
};

// ---- Heatmap Generator color ramps types
export type ColorRampId =
  | 'teal'
  | 'magenta'
  | 'lilac'
  | 'salmon'
  | 'sky'
  | 'red'
  | 'yellow'
  | 'green'
  | 'orange'
  | 'bathymetry'; // Custom one for the bathymetry dataset

const MIN_OPACITY = 0.1;

const getColorRampByOpacitySteps = (
  finalColor: string,
  numSteps = COLOR_RAMP_DEFAULT_NUM_STEPS
) => {
  const color = finalColor?.includes('#')
    ? hexToRgbString(finalColor)
    : finalColor;
  const opacityStep = (1 - MIN_OPACITY) / numSteps;
  const opacitySteps = [...Array(numSteps)].map(
    (_, i) => MIN_OPACITY + (i + 1) * opacityStep
  );
  return opacitySteps.map((opacity) => `rgba(${color}, ${opacity})`);
};

const HEATMAP_COLORS_BY_ID: Record<ColorRampId, string> = {
  teal: '#00FFBC',
  magenta: '#FF64CE',
  lilac: '#9CA4FF',
  salmon: '#FFAE9B',
  sky: '#00EEFF',
  red: '#FF6854',
  yellow: '#FFEA00',
  green: '#A6FF59',
  orange: '#FFAA0D',
  bathymetry: '#4069a6',
};

export const getColorRamp = ({ rampId }: { rampId: ColorRampId }) => {
  const ramp = getColorRampByOpacitySteps(HEATMAP_COLORS_BY_ID[rampId]);
  return ramp.map((rgba) => rgbaStringToObject(rgba));
};

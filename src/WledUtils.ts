/**
 * Translates HSV to RGB
 * @param r RED color 0..255
 * @param g GREEN color 0..255
 * @param b BLUE color 0..255
 * @returns [H, S, V]
 */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  // Normalize RGB values to be in the range [0, 1]
  const normalizedR = r / 255;
  const normalizedG = g / 255;
  const normalizedB = b / 255;

  // Find the maximum and minimum values among RGB components
  const max = Math.max(normalizedR, normalizedG, normalizedB);
  const min = Math.min(normalizedR, normalizedG, normalizedB);

  // Calculate the value (V)
  const v = max;

  // Calculate the saturation (S)
  const s = (max === 0) ? 0 : (max - min) / max;

  // Calculate the hue (H)
  let h = 0;

  if (max === min) {
    // Achromatic (gray) case, H is undefined but typically set to 0
    h = 0;
  } else {
    const delta = max - min;
    if (max === normalizedR) {
      h = (normalizedG - normalizedB) / delta + ((normalizedG < normalizedB) ? 6 : 0);
    } else if (max === normalizedG) {
      h = (normalizedB - normalizedR) / delta + 2;
    } else {
      h = (normalizedR - normalizedG) / delta + 4;
    }

    // Normalize H to be in the range [0, 1]
    h /= 6;
  }

  return { h, s, v };
}

/**
 * Translates HSV to RGB
 * @param h (H)ue
 * @param s (S)aturation
 * @param v (V)alue
 * @returns [R,G,B] Color 0..255
 */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  // Ensure H, S, and V are within valid ranges
  const hue = (h >= 0 && h <= 1) ? h : h % 1;
  const saturation = Math.max(0, Math.min(1, s));
  const value = Math.max(0, Math.min(1, v));

  // Calculate RGB components
  let r, g, b;

  const i = Math.floor(hue * 6);
  const f = hue * 6 - i;
  const p = value * (1 - saturation);
  const q = value * (1 - f * saturation);
  const t = value * (1 - (1 - f) * saturation);

  switch (i % 6) {
    case 0:
      r = value;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = value;
      b = p;
      break;
    case 2:
      r = p;
      g = value;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = value;
      break;
    case 4:
      r = t;
      g = p;
      b = value;
      break;
    case 5:
      r = value;
      g = p;
      b = q;
      break;
    default:
      break;
  }

  // Convert RGB values to the range [0, 255]
  const normalizedR = Math.round(r * 255);
  const normalizedG = Math.round(g * 255);
  const normalizedB = Math.round(b * 255);

  return { r: normalizedR, g: normalizedG, b: normalizedB };
}

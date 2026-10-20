import { encode } from 'jpeg-js';

/**
 * Fotos de exemplo geradas localmente (nada com direitos autorais): céu, chão e uma casa
 * estilizada, com a cor variando por imóvel e o enquadramento variando por foto.
 */

const WIDTH = 1024;
const HEIGHT = 768;

type Rgb = [number, number, number];

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as Rgb;
}

/** `hue`: cor do imóvel (0–360). `variant`: muda posição e tamanho da casa em cada foto. */
export function placeholderPhoto(hue: number, variant: number): Buffer {
  const data = Buffer.alloc(WIDTH * HEIGHT * 4);
  const skyTop: Rgb = hslToRgb(205, 0.65, 0.55 + (variant % 3) * 0.05);
  const skyBottom: Rgb = hslToRgb(200, 0.5, 0.85);
  const ground: Rgb = hslToRgb(110 + variant * 8, 0.35, 0.42);
  const wall: Rgb = hslToRgb(hue, 0.45, 0.62);
  const roof: Rgb = hslToRgb((hue + 180) % 360, 0.4, 0.35);
  const window: Rgb = hslToRgb(45, 0.8, 0.8);

  const horizon = Math.round(HEIGHT * (0.62 + (variant % 2) * 0.05));
  const houseWidth = Math.round(WIDTH * (0.34 + (variant % 4) * 0.06));
  const houseLeft = Math.round(WIDTH * (0.12 + (variant % 5) * 0.11));
  const houseTop = horizon - Math.round(houseWidth * 0.55);
  const roofHeight = Math.round(houseWidth * 0.35);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let color: Rgb = y < horizon ? mix(skyTop, skyBottom, y / horizon) : ground;
      const inHouseX = x >= houseLeft && x < houseLeft + houseWidth;
      if (inHouseX && y >= houseTop && y < horizon) {
        color = wall;
        const col = (x - houseLeft) / houseWidth;
        const row = (y - houseTop) / (horizon - houseTop);
        const isWindow =
          ((col > 0.12 && col < 0.32) || (col > 0.68 && col < 0.88)) && row > 0.2 && row < 0.5;
        const isDoor = col > 0.42 && col < 0.58 && row > 0.45;
        if (isWindow) color = window;
        if (isDoor) color = roof;
      }
      const roofRow = houseTop - y;
      if (roofRow > 0 && roofRow <= roofHeight) {
        const halfWidth = (houseWidth / 2 + 24) * (1 - roofRow / roofHeight);
        const center = houseLeft + houseWidth / 2;
        if (Math.abs(x - center) <= halfWidth) color = roof;
      }
      const offset = (y * WIDTH + x) * 4;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = 255;
    }
  }
  return encode({ data, width: WIDTH, height: HEIGHT }, 82).data;
}

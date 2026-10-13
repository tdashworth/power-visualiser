import { BrandVariants, createDarkTheme, createLightTheme, Theme } from "@fluentui/react-components";

export const tealBrand: BrandVariants = {
  10: "#020404",
  20: "#0F1C1B",
  30: "#132E2E",
  40: "#153C3C",
  50: "#154A4A",
  60: "#135858",
  70: "#106767",
  80: "#087676",
  90: "#1B8584",
  100: "#3F9291",
  110: "#5A9F9E",
  120: "#72ACAB",
  130: "#89B9B8",
  140: "#A0C7C6",
  150: "#B7D4D3",
  160: "#CEE2E1",
};

export const tealLightTheme: Theme = {
  ...createLightTheme(tealBrand),
};

export const tealDarkTheme: Theme = {
  ...createDarkTheme(tealBrand),
};

tealDarkTheme.colorBrandForeground1 = tealBrand[110];
tealDarkTheme.colorBrandForeground2 = tealBrand[120];

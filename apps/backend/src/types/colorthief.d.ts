declare module "colorthief" {
  export function getColor(
    image: Buffer,
    quality?: number
  ): Promise<[red: number, green: number, blue: number]>;

  export function getPalette(
    image: Buffer,
    colorCount?: number,
    quality?: number
  ): Promise<Array<[red: number, green: number, blue: number]>>;
}

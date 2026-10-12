import type { CSSProperties } from 'react';
import { Sprite } from './Sprite';

/** One 16×16 map tile from the farm atlas, or from the masked atlas for tiles maskStart..1047 (848 by default). */
export function TileSprite({ tile, atlas, masked, maskStart = 848, className, style }: {
  tile: number; atlas: string; masked: string; maskStart?: number; className?: string; style?: CSSProperties;
}) {
  const isMasked = tile >= maskStart && tile < 1048, index = isMasked ? tile - 848 : tile;
  return <Sprite className={className} image={isMasked ? masked : atlas} x={index % 32 * 16} y={Math.floor(index / 32) * 16} width={16} height={16} style={style} />;
}

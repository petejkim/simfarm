import type { CSSProperties } from 'react';
import { Sprite } from './Sprite';

/** One 16×16 map tile from the farm atlas, or from the masked atlas for tiles 848..1047. */
export function TileSprite({ tile, atlas, masked, className, style }: {
  tile: number; atlas: string; masked: string; className?: string; style?: CSSProperties;
}) {
  const isMasked = tile >= 848 && tile < 1048, index = isMasked ? tile - 848 : tile;
  return <Sprite className={className} image={isMasked ? masked : atlas} x={index % 32 * 16} y={Math.floor(index / 32) * 16} width={16} height={16} style={style} />;
}

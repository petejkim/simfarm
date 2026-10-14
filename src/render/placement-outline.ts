export interface PlacementFootprint { x: number; y: number; width: number; height: number }

/** Preservation reference (the live UI uses the user's fixed-color CSS border).
 * Source22684..2279d: eight inclusive XOR lines; overlaps toggle twice.
 * Coordinates are world pixels, with the caller's16px snapping already applied.
 * Even-odd clipping reproduces the XOR coverage without GPU color inversion. */
export function clipPlacementOutline(context: CanvasRenderingContext2D, footprint: PlacementFootprint): void {
  const left=footprint.x*16, top=footprint.y*16, width=footprint.width*16, height=footprint.height*16;
  const right=left+width-1, bottom=top+height-1;
  context.beginPath();
  for(const y of [top,top-1,bottom,bottom-1])context.rect(left,y,width,1);
  for(const x of [left,left-1,right-1,right])context.rect(x,top,1,height);
  context.clip('evenodd');
}

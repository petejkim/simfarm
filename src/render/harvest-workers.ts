/** Map animation e5dd..e5ed / e2cc..e2e5 alternates original tiles1036/1037.
 * The atlas starts at848; preserve the randomly selected initial frame. */
export function harvestWorkerTile(maskedTile:number,phase:number):number {
  return phase && (maskedTile===188 || maskedTile===189) ? maskedTile^1 : maskedTile;
}

/** Native presentation cadence, independent of DOS timers and simulation speed.
 * This clock never writes map records or consumes the farm's random streams. */
export class HarvestWorkerAnimation {
  private last:number|null=null;
  private elapsed=0;
  get phase(){return Math.floor(this.elapsed/250);}
  suspend(){this.last=null;}
  reset(){this.suspend();this.elapsed=0;}
  advance(now:number):boolean {
    const before=this.phase;
    if(this.last!==null)this.elapsed=(this.elapsed+Math.max(0,now-this.last))%500;
    this.last=now;
    return before!==this.phase;
  }
}

import type { GameAssets } from '../assets/game-assets';
import type { GameSnapshot } from '../simulation/game';
import { examineObject, type ExamineObject, type ExamineTile } from '../simulation/examine-object';
import { GameWindow } from './GameWindow';
import { ConditionBadge, CONDITION_WORDS } from './ConditionBadge';
import { SunkenInset } from './chrome/SunkenInset';
import { Sprite } from './chrome/Sprite';

/** Original Examine card (overlay12 38b4a): wooden frame, a sunken photo box and a sunken information box,
 * rebuilt from shared components. The photo comes from the buy-cards atlas; machinery, animal, chemical and
 * building-content sprites from the farm's tile atlases; name, damage, condition and value are HTML. */
export function ExamineWindow({assets,snapshot,tiles,position}:{assets:GameAssets;snapshot:GameSnapshot;tiles:HTMLImageElement;position:{x:number;y:number}|null}){
  const world=snapshot.scenario;
  const view=position?examineObject(world,snapshot.finances,assets.catalog.crops,assets.buyCatalog,assets.examineData,assets.itemText,position.x,position.y):null;
  return <GameWindow windowKey="examine" title="Examine" framed>
    {view&&<section className="examine-window" aria-label="Object information" data-kind={view.kind}>
      <SunkenInset className="examine-photo">
        {view.card>=0&&view.card<80&&<Sprite className="examine-card" image={assets.buyCards.src} x={view.card%8*112} y={Math.floor(view.card/8)*64} width={112} height={64} label="Original object illustration"/>}
      </SunkenInset>
      <SunkenInset className="examine-info">{view.fullText
        ? <p id="examine-text" tabIndex={0} className="examine-description">{view.text}</p>
        : <ExamineDetail view={view} assets={assets} tiles={tiles}/>}</SunkenInset>
    </section>}
  </GameWindow>;
}

/** Named objects as flex rows: name; then damage (buildings) or sprite, condition and value (items);
 * then building contents. Sprite grids keep the source tile arrangement. */
function ExamineDetail({view,assets,tiles}:{view:ExamineObject;assets:GameAssets;tiles:HTMLImageElement}){
  const sprites=<TileGrid tiles={view.tiles} assets={assets} atlas={tiles}/>;
  return <div className="examine-detail">
    <p id="examine-text" className="examine-name">{view.text}</p>
    {view.damage!==undefined?<>
      <div className="examine-row">
        <span className="examine-damage" aria-label={`Damage ${view.damage} of 64`}>{assets.examineData.strings.damage}</span>
        <span className="examine-damage-meter" aria-hidden="true"><span style={{width:view.damage}}/></span>
      </div>
      {view.tiles.length>0&&sprites}
    </>:<div className="examine-row">
      {sprites}
      {view.quality!==undefined&&<ConditionBadge className="examine-condition" quality={view.quality} artwork={assets.sellCondition} label={`Condition ${CONDITION_WORDS[view.quality]}`}/>}
      {view.value!==undefined&&<span id="examine-value">${view.value}</span>}
    </div>}
  </div>;
}

/** 16×16 tiles in their source arrangement (columns/rows from the source drawing offsets). */
function TileGrid({tiles,assets,atlas}:{tiles:ExamineTile[];assets:GameAssets;atlas:HTMLImageElement}){
  const shown=tiles.filter(t=>t.tile>=0&&t.tile<1392);
  if(!shown.length)return null;
  const x0=Math.min(...shown.map(t=>t.x)),y0=Math.min(...shown.map(t=>t.y));
  return <div className="examine-tiles">{shown.map((t,i)=>{
    const masked=t.tile>=848&&t.tile<1048,index=masked?t.tile-848:t.tile;
    return <Sprite key={i} className="examine-sprite" image={masked?assets.maskedTiles.src:atlas.src} x={index%32*16} y={Math.floor(index/32)*16} width={16} height={16}
      style={{gridColumn:(t.x-x0)/16+1,gridRow:(t.y-y0)/16+1}}/>;
  })}</div>;
}

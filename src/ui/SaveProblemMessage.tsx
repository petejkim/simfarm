import type {GameAssets} from '../assets/game-assets';
import type {SaveProblem} from '../storage/autosave';
import {MessageDialog} from './MessageDialog';

/** Native warning (user request): automatic browser saves are not reaching the stored game. Uses the original
 * message popup with portrait 76, the frustrated farmer of "unable to pay your taxes" (finance message 159). */
export function saveProblemText(problem:SaveProblem):string{
  if(problem.reason==='other-tab')return 'SimFarm is open in another window, and only one window can save. This farm will not be saved automatically until the other SimFarm windows are closed.';
  if(problem.reason==='unavailable')return 'This browser cannot store your farm, so it will not be saved automatically. Use Save to File... to keep a copy.';
  return `Your farm could not be saved automatically (${problem.error}). Use Save to File... to keep a copy.`;
}
export function SaveProblemMessage({problem,assets,onClose}:{problem:SaveProblem;assets:GameAssets;onClose:()=>void}){
  return <MessageDialog windowKey="save-problem" assets={assets} portrait={76} textId="save-problem-text" data={{'data-save-problem':problem.reason}}
    text={saveProblemText(problem)} onClose={onClose} buttons={[{caption:'OK',id:'save-problem-ok',onClick:onClose}]}/>;
}

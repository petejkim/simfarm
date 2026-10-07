import type { GameCommand, GameSnapshot } from '../simulation/game';
import type { TownChoice } from '../simulation/town-construction';
const choices: [TownChoice, string][] = [
  ['residential', 'Residential'], ['commercial', 'Commercial'], ['airport', 'Airport'],
  ['recreational', 'Recreational'], ['timeout', 'Let town decide'],
];
export function TownChoicePanel({ snapshot, onCommand }: {
  snapshot: GameSnapshot; onCommand: (command: GameCommand) => void;
}) {
  const pending = snapshot.pendingTown, result = snapshot.lastTownResult;
  if (!pending) return null;
  return <section id="town-choice" className="default-panel" role="alert" aria-labelledby="town-choice-title">
    <h2 id="town-choice-title">The town is expanding</h2>
    <p>Choose the new district for plot {pending.site.regionX + 1}, {pending.site.regionY + 1}. The town has paid for this land from its expansion fund.</p>
    <p>Time is paused until you choose. You can save now and make the choice after loading your farm.</p>
    <div className="town-choices">{choices.map(([choice, label]) =>
      <button key={choice} id={`town-${choice}`} onClick={() => onCommand({ type: 'choose-town', choice })}>{label}</button>)}</div>
    {result && !result.ok && <p id="town-choice-error" role="status">{result.reason === 'recreation-limit'
      ? 'The town cannot support another recreational district yet. Choose another district.'
      : 'That district could not be built. Please choose again.'}</p>}
  </section>;
}

import type {EventTextLine} from '../formats/event-text';

/** events.dat message lines as real text: each forced line break starts a new block, and source-indented titles
 * are centred. */
export function EventTextLines({lines}:{lines:readonly EventTextLine[]}){
  return <>{lines.map((line,i)=><span key={i} className="message-line" data-centered={line.centered||undefined}>{line.text}</span>)}</>;
}

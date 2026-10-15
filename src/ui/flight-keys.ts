import type { FlightControl } from '../simulation/aircraft-flight';

/** Native flight keys (user request), by physical key so they work on any keyboard layout:
 * S climb, W descend, A/D turn, E end flight, Space toggles spraying. FlightOverlay shows them as hints (touch: buttons). */
const keys: Record<string, FlightControl> = { KeyS: 'climb', KeyW: 'descend', KeyA: 'left', KeyD: 'right', KeyE: 'end', Space: 'spray-toggle' };
export function flightControlForKey(event: Pick<KeyboardEvent, 'code' | 'altKey' | 'ctrlKey' | 'metaKey' | 'repeat'>): FlightControl | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  // Browser auto-repeat (~30 events/s) is ignored; holding is paced by flightKeyRepeats instead.
  return event.repeat ? null : keys[event.code] ?? null;
}
/** Held turn/altitude keys repeat at most this often, and only once the flight has consumed the previous control. */
export const FLIGHT_KEY_REPEAT_MS = 120;
export const flightKeyRepeats = (control: FlightControl) => control !== 'spray-toggle' && control !== 'end';

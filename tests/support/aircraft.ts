import { constructTownDistrict } from '../../src/simulation/town-construction';
import { originalTownLayouts } from './game';
import { shopFixture } from './livestock';

/** A real constructed airport preserves original0xa5: only its x5 pad is free. */
export function aircraftFixture() {
  const f = shopFixture(), w = f.state.scenario;
  w.regionalConditions.fill(0); f.state.finances.town.airportCount = 0;
  for (const d of w.equipmentDefinitions) d.ownedCount = 0;
  const site = { regionX: 2, regionY: 2 };
  const result = constructTownDistrict(w, f.state.finances.town, originalTownLayouts, site, 5);
  if (!result.ok) throw new Error('Aircraft fixture airport failed');
  f.state.finances.town.activeSite = site;
  return f;
}

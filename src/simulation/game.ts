import type { CropDefinition } from '../formats/crop';
import { FieldRecord } from '../formats/field';
import { EquipmentRecord, EquipmentDefinition } from '../formats/equipment';
import { AnimalRecord } from '../formats/animal';
import { BuildingRecord, BuildingDefinition } from '../formats/building';
import type { Scenario } from '../formats/scenario';
import { advanceCalendarDay } from './calendar';
import { changeFieldCondition } from './field-conditions';
import { updateGrowingField } from './field-lifecycle';
import { updateFieldStatus } from './field-status';
import { updateFieldWater } from './field-water';
import { FarmRandom, type RandomState } from './random';
import { applyDailyWeather, advanceForecast, initializeWeather, updateWeeklyWind, type WeatherState } from './weather';

export interface GameSnapshot {
  revision: number;
  scenario: Scenario;
  weather: WeatherState;
  daysAdvanced: number;
  paused: boolean;
}
export type GameCommand = { type: 'advance-day' } | { type: 'set-paused'; paused: boolean };

function copyScenario(scenario: Scenario): Scenario {
  return { ...scenario, cells: scenario.cells.map(c => ({ ...c })), cropFiles: [...scenario.cropFiles],
    fields: scenario.fields.map(f => new FieldRecord(f.slot, Uint8Array.from(f.bytes))),
    equipment: scenario.equipment.map(e => new EquipmentRecord(e.slot, Uint8Array.from(e.bytes))),
    equipmentDefinitions: scenario.equipmentDefinitions.map(e => new EquipmentDefinition(e.slot, Uint8Array.from(e.bytes))),
    animals: scenario.animals.map(a => new AnimalRecord(a.slot, Uint8Array.from(a.bytes))),
    buildings: scenario.buildings.map(b => new BuildingRecord(b.slot, Uint8Array.from(b.bytes))),
    buildingDefinitions: scenario.buildingDefinitions.map(b => new BuildingDefinition(Uint8Array.from(b.bytes))),
    farm: { ...scenario.farm, calendar: { ...scenario.farm.calendar } },
    regionalConditions: Uint8Array.from(scenario.regionalConditions),
    climate: { wind: [...scenario.climate.wind], precipitation: [...scenario.climate.precipitation], temperature: [...scenario.climate.temperature] } };
}

/** Owns mutable game state. React receives detached snapshots and submits commands.
 * The current scheduler covers calendar, climate and growing fields; machinery/economy/disasters remain to be ported.
 */
export class GameSimulation {
  private readonly scenario: Scenario;
  private readonly crops: readonly (readonly number[])[];
  private readonly random: FarmRandom;
  private readonly weather: WeatherState;
  private readonly listeners = new Set<() => void>();
  private snapshot!: GameSnapshot;
  private daysAdvanced = 0;
  private paused = true;
  private elapsed = 0;
  private disasterFlags = 0;

  constructor(scenario: Scenario, crops: readonly CropDefinition[], seeds: RandomState = { visual: 27, simulation: 9029, bounded: 51 }) {
    this.scenario = copyScenario(scenario);
    this.crops = scenario.cropFiles.map(file => {
      const crop = crops.find(c => `${c.id}.crp` === file);
      if (!crop) throw new Error(`Missing simulation crop ${file}`);
      return [...crop.rawDefinition];
    });
    this.random = new FarmRandom(seeds);
    this.weather = initializeWeather(this.scenario.climate, this.scenario.farm.calendar, this.scenario.farm.precipitationDays, this.random, this.scenario.cells);
    this.publish();
  }

  getSnapshot = (): GameSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  dispatch(command: GameCommand): void {
    if (command.type === 'set-paused') {
      if (this.paused === command.paused) return;
      this.paused = command.paused; this.elapsed = 0;
    } else {
      this.advanceDay();
    }
    this.publish();
  }

  /** Browser pacing only: one game day per second while playing. Original DOS timer speed is not claimed. */
  tick(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Invalid elapsed time');
    if (this.paused) return;
    this.elapsed += milliseconds;
    if (this.elapsed < 1000) return;
    while (this.elapsed >= 1000) { this.elapsed -= 1000; this.advanceDay(); }
    this.publish();
  }

  private advanceDay(): void {
    const s = this.scenario, w = this.weather, before = s.farm.calendar;
    this.random.nextSimulation(); // Calendar entry 0xc899; additional DOS frame/UI consumers are not reproduced.
    const next = advanceCalendarDay(before);
    // 0xd1ae runs after incrementing day but BEFORE wrapping day seven to zero.
    if (w.temperatureAnomaly >= 2) { w.temperature = (w.temperature - w.temperatureAnomaly) | 0; w.temperatureAnomaly -= 2; }
    else w.temperatureAnomaly = 0;
    if ((before.day + 1) & 1) for (const field of s.fields.filter(f => f.active)) {
      const crop = this.crops[field.cropSlot];
      changeFieldCondition(field, crop, s.regionalConditions, 1, 1);
      changeFieldCondition(field, crop, s.regionalConditions, 2, 2);
      updateFieldStatus(field, crop, s.cells);
    }
    if (next.weekEnded) {
      // Weekly dispatcher 0xbdbe updates old week's wind and field water before the calendar rolls.
      const wind = updateWeeklyWind(w, s.climate, before);
      this.disasterFlags = wind.storm ? this.disasterFlags | 8 : this.disasterFlags & ~8;
      if (wind.hurricane) this.disasterFlags |= 1;
      else if (w.wind < 70) this.disasterFlags &= ~1;
      for (const field of s.fields.filter(f => f.active)) {
        updateFieldWater(field, s.cells, w.soilMoisture, this.disasterFlags);
        updateFieldStatus(field, this.crops[field.cropSlot], s.cells);
      }
      // 0xcbc6 indexes temperature before month/year rollover. Index 240 aliases DS:4368 (wind).
      const index = w.temperatureYear * 48 + before.month * 4 + before.week + 1;
      w.temperature = index === 240 ? w.wind : s.climate.temperature[index];
      if (next.monthEnded) this.random.mixMonth(before.month + 1);
      if (next.yearEnded) {
        w.temperatureYear = (w.temperatureYear + 1) % 5;
        w.precipitationYear = (w.precipitationYear + 1) % 5;
        w.windYear = (w.windYear + 1) % 5;
      }
      w.windAnomaly = Math.max(0, w.windAnomaly - 2);
      advanceForecast(w, s.climate, next.calendar, this.random, s.cells);
    }
    s.farm.calendar = next.calendar;
    w.displayTemperature = (w.temperature + this.random.below(5)) << 24 >> 24;
    applyDailyWeather(w, next.calendar.day);
    s.farm.precipitationDays = w.precipitationDays;
    for (const field of s.fields.filter(f => f.active)) updateGrowingField(field, this.crops[field.cropSlot], {
      week: next.calendar.week, temperature: w.temperature << 16 >> 16, regions: s.regionalConditions, cells: s.cells, random: this.random,
    });
    this.daysAdvanced++;
  }

  private publish(): void {
    this.snapshot = { revision: (this.snapshot?.revision ?? -1) + 1, scenario: copyScenario(this.scenario),
      weather: { ...this.weather, forecast: [...this.weather.forecast], nextForecast: [...this.weather.nextForecast] },
      daysAdvanced: this.daysAdvanced, paused: this.paused };
    for (const listener of [...this.listeners]) listener();
  }
}

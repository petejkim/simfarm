import type { CropDefinition } from '../formats/crop';
import { FieldRecord } from '../formats/field';
import { FieldSchedule } from '../formats/field-schedule';
import { EquipmentRecord, EquipmentDefinition } from '../formats/equipment';
import { AnimalRecord } from '../formats/animal';
import { BuildingRecord, BuildingDefinition } from '../formats/building';
import { InventoryRecord, GoodsDefinition } from '../formats/inventory';
import { ChemicalRecord } from '../formats/chemical';
import type { Scenario } from '../formats/scenario';
import { advanceCalendarDay } from './calendar';
import { changeFieldCondition } from './field-conditions';
import { updateGrowingField } from './field-lifecycle';
import { updateFieldStatus } from './field-status';
import { updateFieldWater } from './field-water';
import { FarmRandom, type RandomState } from './random';
import { applyDailyWeather, advanceForecast, initializeWeather, updateWeeklyWind, type WeatherState } from './weather';
import { plantField, plantNewField, type PlantResult, type NewFieldResult } from './plant-order';
import { updatePlantingField } from './field-planting';
import { updateEquipment } from './equipment-dispatch';
import { reserveEquipment } from './equipment-rental';
import type { EquipmentRuntime } from './equipment-world';
import { orderHarvest, updateHarvestField, type HarvestOrderResult } from './field-harvest';
import { cropMaturity, fieldHarvestValue } from './harvest-value';
import { sellStoredHarvest, storedHarvestValue, type HarvestSaleResult } from './harvest-sale';
import { purchaseLand, type LandPurchaseResult } from './land';
import { orderTreatment, updateTreatmentField, type Treatment, type TreatmentResult } from './field-treatment';
import { recordFieldPlanOrder } from './field-plan-order';
import { dispatchFieldSchedule, type ScheduleDispatchResult } from './field-calendar';
import { projectFieldScheduleYear } from './field-projection';

import { SIMULATION_SPEEDS, type SimulationState } from './save-state';
import { readNativeSave, writeNativeSave } from '../formats/native-save';
export { SIMULATION_SPEEDS } from './save-state';

export interface FieldHarvestEstimate {
  maturity: number;
  value: number;
  workerFee: number;
}

export interface GameSnapshot {
  revision: number;
  scenario: Scenario;
  weather: WeatherState;
  daysAdvanced: number;
  paused: boolean;
  speed: number;
  cropMarketPrices: number[];
  lastPlantResult: PlantResult | null;
  lastHarvestResult: HarvestOrderResult | null;
  fieldHarvestEstimates: (FieldHarvestEstimate | null)[];
  storedHarvestValues: (number | null)[];
  lastSaleResult: HarvestSaleResult | null;
  lastLandResult: LandPurchaseResult | null;
  lastNewFieldResult: NewFieldResult | null;
  lastTreatmentResult: TreatmentResult | null;
  lastScheduleResult: ScheduleDispatchResult | null;
}
export type GameCommand = { type: 'advance-day' } | { type: 'set-paused'; paused: boolean }
  | { type: 'set-speed'; speed: number }
  | { type: 'set-auto-clear'; enabled: boolean }
  | { type: 'buy-land'; regionX: number; regionY: number }
  | { type: 'create-field'; x: number; y: number; cropSlot: number }
  | { type: 'treat-field'; fieldSlot: number; treatment: Treatment }
  | { type: 'plant-field'; fieldSlot: number; cropSlot: number }
  | { type: 'harvest-field'; fieldSlot: number }
  | { type: 'sell-harvest'; inventorySlot: number };

function copyScenario(scenario: Scenario): Scenario {
  return { ...scenario, schedule: new FieldSchedule(Uint8Array.from(scenario.schedule.bytes)), sourceBytes: Uint8Array.from(scenario.sourceBytes), cells: scenario.cells.map(c => ({ ...c })), cropFiles: [...scenario.cropFiles],
    fields: scenario.fields.map(f => new FieldRecord(f.slot, Uint8Array.from(f.bytes))),
    equipment: scenario.equipment.map(e => new EquipmentRecord(e.slot, Uint8Array.from(e.bytes))),
    equipmentDefinitions: scenario.equipmentDefinitions.map(e => new EquipmentDefinition(e.slot, Uint8Array.from(e.bytes))),
    animals: scenario.animals.map(a => new AnimalRecord(a.slot, Uint8Array.from(a.bytes))),
    buildings: scenario.buildings.map(b => new BuildingRecord(b.slot, Uint8Array.from(b.bytes))),
    buildingDefinitions: scenario.buildingDefinitions.map(b => new BuildingDefinition(Uint8Array.from(b.bytes))),
    inventory: scenario.inventory.map(i => new InventoryRecord(i.slot, Uint8Array.from(i.bytes))),
    chemicals: scenario.chemicals.map(i => new ChemicalRecord(i.slot, Uint8Array.from(i.bytes))),
    chemicalDefinitions: scenario.chemicalDefinitions.map(d => new GoodsDefinition(Uint8Array.from(d.bytes))),
    seedDefinitions: scenario.seedDefinitions.map(d => new GoodsDefinition(Uint8Array.from(d.bytes))),
    cropDefinitions: scenario.cropDefinitions.map(d => new GoodsDefinition(Uint8Array.from(d.bytes))),
    harvestDefinitions: scenario.harvestDefinitions.map(d => new GoodsDefinition(Uint8Array.from(d.bytes))),
    farm: { ...scenario.farm, calendar: { ...scenario.farm.calendar } },
    regionalConditions: Uint8Array.from(scenario.regionalConditions),
    climate: { wind: [...scenario.climate.wind], precipitation: [...scenario.climate.precipitation], temperature: [...scenario.climate.temperature] } };
}

/** Owns mutable game state. React receives detached snapshots and submits commands.
 * The scheduler covers calendar, climate, machinery, planting, growth and harvesting.
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
  private speed = 1;
  private elapsed = 0;
  private disasterFlags = 0;
  private dayTicks = 0;
  private readonly equipmentRuntime: EquipmentRuntime = { grassTravelCount: 0, animationTick: 0, notices: [] };
  private readonly cropMarketPrices: number[];
  private lastPlantResult: PlantResult | null = null;
  private lastHarvestResult: HarvestOrderResult | null = null;
  private lastSaleResult: HarvestSaleResult | null = null;
  private lastLandResult: LandPurchaseResult | null = null;
  private lastNewFieldResult: NewFieldResult | null = null;
  private lastTreatmentResult: TreatmentResult | null = null;
  private lastScheduleResult: ScheduleDispatchResult | null = null;

  constructor(scenario: Scenario, crops: readonly CropDefinition[], seeds: RandomState = { visual: 27, simulation: 9029, bounded: 51 }, restored?: SimulationState) {
    this.scenario = copyScenario(scenario);
    this.crops = scenario.cropFiles.map(file => {
      const crop = crops.find(c => `${c.id}.crp` === file);
      if (!crop) throw new Error(`Missing simulation crop ${file}`);
      return [...crop.rawDefinition];
    });
    if (restored) {
      if (this.crops.some((crop, i) => crop.some((byte, j) => byte !== restored.crops[i][j]))) {
        throw new Error('Save uses different crop definitions; restore the matching original assets.');
      }
      this.random = new FarmRandom(restored.random);
      this.cropMarketPrices = [...restored.cropMarketPrices];
      this.weather = { ...restored.weather, forecast: [...restored.weather.forecast], nextForecast: [...restored.weather.nextForecast] };
      this.daysAdvanced = restored.daysAdvanced; this.paused = restored.paused; this.speed = restored.speed;
      this.elapsed = restored.elapsed; this.dayTicks = restored.dayTicks; this.disasterFlags = restored.disasterFlags;
      this.equipmentRuntime.grassTravelCount = restored.grassTravelCount;
      this.equipmentRuntime.animationTick = restored.equipmentAnimationTick;
    } else {
      this.random = new FarmRandom(seeds);
      // Crop loading 0x466d0..0x46728 overrides saved crop/seed prices from the loaded definitions.
      this.cropMarketPrices = this.crops.map(c => c[34] | c[35] << 8);
      this.crops.forEach((c, slot) => {
        this.scenario.cropDefinitions[slot].price = this.cropMarketPrices[slot];
        this.scenario.seedDefinitions[slot].price = Math.max(5, (c[38] | c[39] << 8) >>> 2);
      });
      this.weather = initializeWeather(this.scenario.climate, this.scenario.farm.calendar, this.scenario.farm.precipitationDays, this.random, this.scenario.cells);
    }
    this.publish();
  }

  /** Exact native checkpoint, including partial ticks. Does not mutate or advance the farm. */
  save(scenarioId: number): string {
    return writeNativeSave({ scenario: this.scenario, crops: this.crops, random: this.random.snapshot(), weather: this.weather,
      daysAdvanced: this.daysAdvanced, paused: this.paused, speed: this.speed, elapsed: this.elapsed, dayTicks: this.dayTicks,
      disasterFlags: this.disasterFlags, grassTravelCount: this.equipmentRuntime.grassTravelCount,
      equipmentAnimationTick: this.equipmentRuntime.animationTick, cropMarketPrices: this.cropMarketPrices }, scenarioId);
  }

  static load(text: string, crops: readonly CropDefinition[]): { scenarioId: number; simulation: GameSimulation } {
    const { scenarioId, state } = readNativeSave(text);
    return { scenarioId, simulation: new GameSimulation(state.scenario, crops, state.random, state) };
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
    } else if (command.type === 'set-speed') {
      if (!SIMULATION_SPEEDS.some(speed => speed === command.speed)) throw new Error('Invalid simulation speed');
      if (this.speed === command.speed) return;
      this.speed = command.speed;
    } else if (command.type === 'set-auto-clear') {
      this.scenario.farm.autoClear = command.enabled;
    } else if (command.type === 'buy-land') {
      this.lastLandResult = purchaseLand(this.scenario, command.regionX, command.regionY, this.weather.soilMoisture);
    } else if (command.type === 'create-field') {
      this.lastPlantResult = null; this.lastHarvestResult = null;
      this.lastNewFieldResult = plantNewField(this.scenario, command.x, command.y, command.cropSlot, this.crops,
        this.cropMarketPrices, this.random, this.weather.soilMoisture);
      if (this.lastNewFieldResult.ok) {
        this.lastPlantResult = this.lastNewFieldResult;
        recordFieldPlanOrder(this.scenario, this.crops, this.lastNewFieldResult.slot, { kind: 'plant', cropSlot: command.cropSlot });
      }
    } else if (command.type === 'treat-field') {
      this.lastTreatmentResult = orderTreatment(this.scenario, command.fieldSlot, command.treatment, this.weather.soilMoisture);
      if (this.lastTreatmentResult.ok) recordFieldPlanOrder(this.scenario, this.crops, command.fieldSlot, { kind: command.treatment });
    } else if (command.type === 'plant-field') {
      this.lastHarvestResult = null;
      this.lastPlantResult = plantField(this.scenario, command.fieldSlot, command.cropSlot, this.crops,
        this.cropMarketPrices, this.random, this.weather.soilMoisture);
      if (this.lastPlantResult.ok) recordFieldPlanOrder(this.scenario, this.crops, command.fieldSlot, { kind: 'plant', cropSlot: command.cropSlot });
    } else if (command.type === 'harvest-field') {
      this.lastPlantResult = null;
      this.lastHarvestResult = orderHarvest(this.scenario, command.fieldSlot, this.crops);
    } else if (command.type === 'sell-harvest') {
      this.lastSaleResult = sellStoredHarvest(this.scenario, command.inventorySlot, this.weather.soilMoisture);
    } else {
      const remaining = Math.max(1, this.scenario.farm.dayDelayTicks) - this.dayTicks;
      for (let i = 0; i < remaining; i++) this.advanceTick();
    }
    this.publish();
  }

  /** Browser pacing only: speed 1 is one game day per second. Original DOS timer speed is not claimed. */
  tick(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Invalid elapsed time');
    if (this.paused) return;
    this.elapsed += milliseconds * this.speed * Math.max(1, this.scenario.farm.dayDelayTicks) / 1000;
    const ticks = Math.floor(this.elapsed + 1e-9);
    if (!ticks) return;
    this.elapsed = Math.max(0, this.elapsed - ticks);
    for (let i = 0; i < ticks; i++) this.advanceTick();
    this.publish();
  }

  private advanceTick(): void {
    const s = this.scenario, tick = s.farm.timerTicks = (s.farm.timerTicks + 1) & 0xffff;
    this.equipmentRuntime.animationTick = s.farm.animationTicks = (s.farm.animationTicks + 1) & 0xffff;
    const allocate = (world: Scenario, type: number, x: number, y: number) => reserveEquipment(world, type, x, y, tick);
    updateEquipment(s, this.equipmentRuntime, tick, s.farm.paceEquipment, allocate);
    for (const field of s.fields) {
      if (!updatePlantingField(field, this.crops[field.cropSlot], s, this.equipmentRuntime, tick, allocate)) break;
      updateHarvestField(field, this.crops[field.cropSlot], s, this.equipmentRuntime, tick, this.random, allocate);
      if (!updateTreatmentField(field, this.crops[field.cropSlot], s, this.equipmentRuntime, tick, this.weather.soilMoisture, allocate)) break;
    }
    if (++this.dayTicks >= Math.max(1, s.farm.dayDelayTicks)) { this.dayTicks = 0; this.advanceDay(); }
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
      // 0xc920 increments week; 0xcbbd dispatches before 0xcc10 normalizes month/week.
      // At year-end this executes old plan row 48 and completes the final week's work.
      s.farm.calendar = { ...before, day: 0, week: before.week + 1, season: next.calendar.season };
      this.lastScheduleResult = dispatchFieldSchedule(s, this.crops, this.cropMarketPrices, this.random, this.equipmentRuntime, w.soilMoisture);
      // 0xcbc6 indexes temperature before month/year rollover. Index 240 aliases DS:4368 (wind).
      const index = w.temperatureYear * 48 + before.month * 4 + before.week + 1;
      w.temperature = index === 240 ? w.wind : s.climate.temperature[index];
      if (next.monthEnded) this.random.mixMonth(before.month + 1);
      if (next.yearEnded) {
        projectFieldScheduleYear(s, this.crops); // 0xcdfe, after dispatch and before weather-year changes.
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
      daysAdvanced: this.daysAdvanced, paused: this.paused, speed: this.speed, cropMarketPrices: [...this.cropMarketPrices],
      lastPlantResult: this.lastPlantResult ? { ...this.lastPlantResult } : null,
      lastHarvestResult: this.lastHarvestResult ? { ...this.lastHarvestResult } : null,
      lastSaleResult: this.lastSaleResult ? { ...this.lastSaleResult } : null,
      lastLandResult: this.lastLandResult ? { ...this.lastLandResult } : null,
      lastNewFieldResult: this.lastNewFieldResult ? { ...this.lastNewFieldResult } : null,
      lastTreatmentResult: this.lastTreatmentResult ? { ...this.lastTreatmentResult } : null,
      lastScheduleResult: this.lastScheduleResult ? { ...this.lastScheduleResult } : null,
      storedHarvestValues: this.scenario.inventory.map(i => i.active && i.type >= 168 && i.type < 184
        ? storedHarvestValue(i, this.scenario) : null),
      fieldHarvestEstimates: this.scenario.fields.map(f => {
        if (!f.active) return null;
        const crop = this.crops[f.cropSlot];
        return { maturity: cropMaturity(f, crop), value: fieldHarvestValue(f, crop, this.cropMarketPrices[f.cropSlot]),
          workerFee: crop[57] === 1 ? f.bytes[58] | f.bytes[59] << 8 : 0 };
      }) };
    for (const listener of [...this.listeners]) listener();
  }
}

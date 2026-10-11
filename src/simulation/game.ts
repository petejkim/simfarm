import {createEditStatus,appendEditStatus,recentEditStatuses,isEditToolStatus,type EditToolStatusCode} from './edit-status';
import {DISASTER_MESSAGES} from '../formats/disaster-message';
import type {DisasterNoticeId} from './events';
import { DISASTER_MENU_KINDS, type DisasterMenuAction } from './disaster-menu';
import { sellManualLand, type ManualLandSaleResult } from './manual-land-sale';
import { expandCropCatalog } from './all-crops';
import { createOriginalSaveStartup, restartOriginalSaveStartup, type OriginalStartupOptions } from './original-startup';
import { calendarDayDue, ticksUntilCalendarDay } from './calendar-clock';
import { initialOriginalPause, type OriginalPauseState } from './original-pause';
import { restartGeneratedFarm, restartRegionFarm, type RestartFarmOptions } from './restart-farm';
import { createGeographicFarm, createGeographicRegion, restartGeographicFarm } from './geographic-setup';
import type { ClimateSelection } from '../formats/new-farm';
import { createSessionSetup, type SessionSetup } from './session-setup';
import { transferOriginalFarm } from './original-load';
import type { ClimateTables } from '../formats/weather';
import { finalizeRegionFarm } from './starting-environment';
import { createColdMarket, loadMarketCropPrices, updateWeeklyMarket, type MarketState } from './market';
import { createNewFarmState, type NewFarmAssets } from './create-farm';
import { coldTrafficDefaults, createTrafficState, snapshotTraffic, type TrafficDefaults, type TrafficState } from '../formats/traffic';
import { allocateTraffic, initializeStartingTraffic } from './starting-traffic';
import { advanceTraffic } from './traffic';
import type { NewFarmOptions, NewFarmState } from './new-farm-state';
import { beginStationaryDisaster, advanceFrostDay, advanceStationaryDisasters,
  type StationaryDisasterKind, type StationaryDisasterStart } from './stationary-disasters';
import { placeTree, type TreePlacementResult } from './tree-placement';
import { placeNetwork, type NetworkAction, type NetworkPlacementResult } from './network-placement';
import { purchaseCropSupply, type CropSupplyPurchaseResult } from './crop-supply-purchase';
import { createMovingDisasters, beginMovingDisaster, stopMovingDisaster, advanceMovingDisasters,
  type MovingDisasterState, type MovingDisasterKind, type MovingDisasterStart } from './moving-disasters';
import { beginWindDisaster, advanceWindDisaster } from './wind-disaster';
import { createWaterDisasters, beginWaterDisaster, stopWaterDisaster, advanceFloodCounter, advanceFlood,
  type WaterDisasterKind, type WaterDisasterState } from './water-disasters';
import { moveManualSupply, type SupplyMoveTarget, type SupplyMoveResult } from './manual-supply-move';
import { moveManualEquipment, toggleManualBuildingInterior, type EquipmentMoveTarget, type EquipmentMoveResult, type BuildingInteriorResult } from './manual-equipment-move';
import { removeManualTarget, type RemovalTarget, type ManualRemovalResult } from './manual-removal';
import { sellManualAsset, type AssetSaleKind, type ManualAssetSaleResult } from './manual-asset-sale';
import { advanceFlight, beginFlight, FLIGHT_CONTROLS, MAX_FLIGHT_INPUTS, type AircraftFlight, type FlightControl, type FlightEnd, type FlightStartResult } from './aircraft-flight';
import type { CropDefinition } from '../formats/crop';
import { FieldRecord } from '../formats/field';
import { FieldSchedule } from '../formats/field-schedule';
import { EquipmentRecord, EquipmentDefinition } from '../formats/equipment';
import { AnimalRecord } from '../formats/animal';
import { BuildingRecord, BuildingDefinition } from '../formats/building';
import { InventoryRecord, GoodsDefinition } from '../formats/inventory';
import { ChemicalRecord } from '../formats/chemical';
import type { Scenario } from '../formats/scenario';
import { advanceCalendarDay, type FarmCalendar } from './calendar';
import { changeFieldCondition } from './field-conditions';
import { updateGrowingField } from './field-lifecycle';
import { updateFieldStatus } from './field-status';
import { updateFieldWater } from './field-water';
import { FarmRandom, type RandomState } from './random';
import { applyDailyWeather, advanceForecast, initializeWeather, updateWeeklyWind, type WeatherState } from './weather';
import { updateAnnualStatistics, updateReportedFieldStatus } from './annual-statistics';
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
import { editFieldPlan, type FieldPlanEdit, type FieldPlanEditResult } from './field-plan-edit';

import { SIMULATION_SPEEDS, type SimulationState, type PendingTownExpansion } from './save-state';
import { readNativeSave, writeNativeSave } from '../formats/native-save';
import { copyFinancialState, readFinancialState, type FinancialState } from '../formats/finance';
import { borrowLoan, repayLoanInFull, loanCreditLimit, payScheduledLoan, isLoanPaymentMonth, type BorrowResult, type RepayResult } from './loan';
import { loanPaymentAccounts, taxAccounts } from './finance-accounts';
import { retryMonthlyDebts } from './monthly-finance';
import { resolveDefaultDecision } from './default';
import { TownLayouts } from '../formats/town';
import { developTown } from './town-development';
import { assessAnnualTax, settleAnnualTax, type TaxAssessment, type TaxSettlement } from './tax';
import { resetAnnualLedgers, updateAnnualReport } from './annual-ledger';
import { summarizeFieldStatus, type FieldReport } from './field-report';
import { beginTownExpansion } from './town';
import { resolveTownChoice, type TownChoice, type TownConstructionResult } from './town-construction';
import { updateClearingEffects } from './clearing-effects';
import { updateHomestead, type HomesteadChange } from './homestead';
import type { GameEvent, AnimalSound, AnimalVocal } from './events';
import { purchaseBuilding, type BuildingPlacementResult } from './building-placement';
import { copyIrrigation } from '../formats/irrigation';
import { updateIrrigation } from './irrigation';
import { placeIrrigation,toggleMapValve, type IrrigationTool, type IrrigationPlacementResult } from './irrigation-placement';
import { createAnimalFrameState, type AnimalFrameState } from './animal-world';
import { advanceAnimalFrame } from './animal-movement';
import { increaseAnimalNeeds } from './animal-needs';
import { purchaseLivestock, type LivestockPurchaseResult } from './livestock-purchase';
import { ageBuildings, fillWaterStorage } from './water-storage';
import { ageInventoryAndRefillTroughs } from './weekly-inventory';
import { ageAnimals, beginAnimalPregnancies, advanceAnimalGestation, type AnimalLifecycleNotice } from './animal-lifecycle';
import { ageEquipment, type EquipmentAgingNotice } from './weekly-equipment';
import { ageChemicals } from './weekly-chemicals';
import { purchaseEquipment, type EquipmentPurchaseResult } from './equipment-purchase';
import { createAircraftServiceState, purchaseAircraft, serviceAircraft, type AircraftServiceAction,
  type AircraftServiceState, type AircraftPurchaseResult, type AircraftServiceResult } from './aircraft';
export { SIMULATION_SPEEDS } from './save-state';

export interface FieldHarvestEstimate {
  maturity: number;
  value: number;
  workerFee: number;
}

export interface GameSnapshot {
  originalPause: OriginalPauseState;
  setup: SessionSetup;
  newFarm: NewFarmState | null;
  retainedSetup: NewFarmState | null;
  traffic: TrafficDefaults;
  disasters: MovingDisasterState;
  waterDisasters: WaterDisasterState;
  lastDisasterResult: StationaryDisasterStart | MovingDisasterStart | { ok: true; kind: WaterDisasterKind | 'wind' } | null;
  disasterNotices: string[];
  editStatuses:number[];
  farmReport: { income: number; expenses: number; net: number; fields: FieldReport };
  revision: number;
  scenario: Scenario;
  weather: WeatherState;
  daysAdvanced: number;
  paused: boolean;
  speed: number;
  finances: FinancialState;
  pendingTown: PendingTownExpansion | null;
  lastTownResult: TownConstructionResult | null;
  lastHomesteadChange: HomesteadChange | null;
  taxAssessment: TaxAssessment;
  lastTaxSettlement: TaxSettlement | null;
  loanCreditLimit: number;
  availableLoan: number;
  lastLoanResult: ({ kind: 'borrow' } & BorrowResult) | ({ kind: 'repay' } & RepayResult) | null;
  financeNotices: number[];
  animalNotices: { slot: number; id: number; animalType: number }[];
  animalLifecycleNotices: AnimalLifecycleNotice[];
  equipmentAgingNotices: EquipmentAgingNotice[];
  animalFrame: AnimalFrameState;
  aircraftService: AircraftServiceState;
  aircraftFlight: AircraftFlight | null;
  lastFlightStartResult: { ok: true } | Extract<FlightStartResult, { ok: false }> | null;
  lastFlightEnd: FlightEnd | null;
  lastAircraftPurchaseResult: AircraftPurchaseResult | null;
  lastAircraftServiceResult: AircraftServiceResult | null;
  cropMarketPrices: number[];
  market: MarketState;
  lastPlantResult: PlantResult | null;
  lastHarvestResult: HarvestOrderResult | null;
  fieldHarvestEstimates: (FieldHarvestEstimate | null)[];
  storedHarvestValues: (number | null)[];
  lastSaleResult: HarvestSaleResult | null;
  lastAssetSaleResult: (ManualAssetSaleResult & { kind: AssetSaleKind }) | null;
  lastRemovalResult: ManualRemovalResult | null;
  lastEquipmentMoveResult: EquipmentMoveResult | null;
  lastSupplyMoveResult: SupplyMoveResult | null;
  lastBuildingInteriorResult: BuildingInteriorResult | null;
  lastLandResult: LandPurchaseResult | null;
  lastLandSaleResult: ManualLandSaleResult | null;
  lastBuildingResult: BuildingPlacementResult | null;
  lastCropSupplyPurchaseResult: (CropSupplyPurchaseResult & { productType: number }) | null;
  lastEquipmentPurchaseResult: (EquipmentPurchaseResult & { equipmentType: number }) | null;
  lastTreeResult: TreePlacementResult | null;
  lastNetworkResult: (NetworkPlacementResult & { tool: NetworkAction }) | null;
  lastIrrigationResult: IrrigationPlacementResult | null;
  lastLivestockResult: (LivestockPurchaseResult & { productType: number }) | null;
  lastNewFieldResult: NewFieldResult | null;
  lastTreatmentResult: TreatmentResult | null;
  lastScheduleResult: ScheduleDispatchResult | null;
  lastPlanEditResult: (FieldPlanEditResult & { fieldSlot: number; week: number }) | null;
}
export type GameCommand = { type: 'advance-day' } | { type: 'set-paused'; paused: boolean }
  | { type: 'set-map-pointer'; pointer: { x: number; y: number } | null }
  | { type: 'borrow'; amount: number } | { type: 'repay-loan' }
  | { type: 'resolve-default'; choice: 'restart' | 'exit' }
  | { type: 'choose-town'; choice: TownChoice }
  | { type: 'edit-field-plan'; fieldSlot: number; week: number; action: FieldPlanEdit }
  | { type: 'set-speed'; speed: number }
  | { type: 'start-disaster'; kind: MovingDisasterKind | WaterDisasterKind | StationaryDisasterKind | 'wind' }
  | { type: 'set-disasters-enabled'; enabled: boolean }
  | { type: 'disaster-menu'; action: DisasterMenuAction }
  | { type: 'set-auto-clear'; enabled: boolean }
  | { type: 'set-option'; option: 'autoBuySeeds' | 'autoRent' | 'autoClear' | 'autoScroll' | 'autoGoto' | 'messages'; enabled: boolean }
  | { type: 'buy-land' | 'sell-land'; regionX: number; regionY: number }
  | { type: 'build'; buildingType: number; x: number; y: number }
  | { type: 'move-supply'; selected: SupplyMoveTarget; x: number; y: number }
  | { type: 'move-equipment'; selected: EquipmentMoveTarget; x: number; y: number }
  | { type: 'toggle-building-interior'; x: number; y: number; slot: number }
  | { type: 'remove-object'; x: number; y: number; kind: RemovalTarget['kind']; slot: number; tile?: number }
  | { type: 'plant-tree'; x: number; y: number }
  | { type: 'network'; tool: NetworkAction; x: number; y: number }
  | { type: 'irrigation'; tool: IrrigationTool; x: number; y: number }
  | { type: 'toggle-valve'; x: number; y: number }
  | { type: 'start-flight'; slot: number; columns: number; rows: number }
  | { type: 'flight-control'; control: FlightControl }
  | { type: 'step-flight' }
  | { type: 'buy-aircraft' }
  | { type: 'service-aircraft'; slot: number; action: AircraftServiceAction }
  | { type: 'buy-crop-supply'; productType: number; x: number; y: number }
  | { type: 'buy-equipment'; equipmentType: number; x: number; y: number }
  | { type: 'buy-livestock'; productType: number; x: number; y: number }
  | { type: 'edit-status'; code:EditToolStatusCode }
  | { type: 'create-field'; x: number; y: number; cropSlot: number }
  | { type: 'treat-field'; fieldSlot: number; treatment: Treatment }
  | { type: 'plant-field'; fieldSlot: number; cropSlot: number }
  | { type: 'harvest-field'; fieldSlot: number }
  | { type: 'sell-asset'; kind: AssetSaleKind; slot: number }
  | { type: 'sell-harvest'; inventorySlot: number };

function copyScenario(scenario: Scenario): Scenario {
  return { ...scenario, irrigation: copyIrrigation(scenario.irrigation), schedule: new FieldSchedule(Uint8Array.from(scenario.schedule.bytes)), sourceBytes: scenario.sourceBytes === null ? null : Uint8Array.from(scenario.sourceBytes), cells: scenario.cells.map(c => ({ ...c })), cropFiles: [...scenario.cropFiles],
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
 * The scheduler covers calendar, climate, machinery, crops, irrigation and livestock.
 */
export class GameSimulation {
  private readonly setup: SessionSetup;
  private readonly scenario: Scenario;
  private readonly newFarm: NewFarmState | null;
  private readonly retainedSetup: NewFarmState | null;
  private readonly crops: readonly (readonly number[])[];
  private readonly random: FarmRandom;
  private readonly weather: WeatherState;
  private readonly finances: FinancialState;
  private readonly townLayouts: TownLayouts;
  private readonly listeners = new Set<() => void>();
  private readonly eventListeners = new Set<(event: GameEvent) => void>();
  private events: GameEvent[] = [];
  private mapPointer: { x: number; y: number } | null = null;
  private snapshot!: GameSnapshot;
  private daysAdvanced = 0;
  private paused = true;
  private readonly originalPause: OriginalPauseState;
  private speed = 1;
  private elapsed = 0;
  private disasters = createMovingDisasters();
  private waterDisasters = createWaterDisasters();
  private lastDisasterResult: GameSnapshot['lastDisasterResult'] = null;
  private editStatus=createEditStatus();
  private disasterNotices: string[] = [];
  private dayTicks = 0;
  private readonly equipmentRuntime: EquipmentRuntime = { grassTravelCount: 0, animationTick: 0, notices: [] };
  private animalFrame = createAnimalFrameState();
  private aircraftService = createAircraftServiceState();
  private aircraftFlight: AircraftFlight | null = null;
  private lastFlightStartResult: GameSnapshot['lastFlightStartResult'] = null;
  private lastFlightEnd: FlightEnd | null = null;
  private lastAircraftPurchaseResult: AircraftPurchaseResult | null = null;
  private lastAircraftServiceResult: AircraftServiceResult | null = null;
  private animalNotices: GameSnapshot['animalNotices'] = [];
  private animalLifecycleNotices: AnimalLifecycleNotice[] = [];
  private equipmentAgingNotices: EquipmentAgingNotice[] = [];
  private readonly cropMarketPrices: number[];
  private readonly market: MarketState;
  private readonly traffic: TrafficState;
  private lastPlantResult: PlantResult | null = null;
  private lastHarvestResult: HarvestOrderResult | null = null;
  private lastSaleResult: HarvestSaleResult | null = null;
  private lastAssetSaleResult: GameSnapshot['lastAssetSaleResult'] = null;
  private lastRemovalResult: ManualRemovalResult | null = null;
  private lastEquipmentMoveResult: EquipmentMoveResult | null = null;
  private lastSupplyMoveResult: SupplyMoveResult | null = null;
  private lastBuildingInteriorResult: BuildingInteriorResult | null = null;
  private lastLandResult: LandPurchaseResult | null = null;
  private lastLandSaleResult: ManualLandSaleResult | null = null;
  private lastCropSupplyPurchaseResult: GameSnapshot['lastCropSupplyPurchaseResult'] = null;
  private lastEquipmentPurchaseResult: GameSnapshot['lastEquipmentPurchaseResult'] = null;
  private lastBuildingResult: BuildingPlacementResult | null = null;
  private lastTreeResult: TreePlacementResult | null = null;
  private lastNetworkResult: GameSnapshot['lastNetworkResult'] = null;
  private lastIrrigationResult: IrrigationPlacementResult | null = null;
  private lastLivestockResult: GameSnapshot['lastLivestockResult'] = null;
  private lastNewFieldResult: NewFieldResult | null = null;
  private lastTreatmentResult: TreatmentResult | null = null;
  private lastScheduleResult: ScheduleDispatchResult | null = null;
  private lastPlanEditResult: GameSnapshot['lastPlanEditResult'] = null;
  private lastLoanResult: GameSnapshot['lastLoanResult'] = null;
  private financeNotices: number[] = [];
  private pendingTown: PendingTownExpansion | null = null;
  private lastTownResult: TownConstructionResult | null = null;
  private lastTaxSettlement: TaxSettlement | null = null;
  private lastHomesteadChange: HomesteadChange | null = null;

  constructor(scenario: Scenario, crops: readonly CropDefinition[], townLayouts: TownLayouts,
    seeds: RandomState = { visual: 27, simulation: 9029, bounded: 51 }, restored?: SimulationState, regionClimate?: ClimateTables) {
    if (!restored && scenario.origin !== 'original') throw new Error('Generated farms require initialized state');
    this.scenario = copyScenario(scenario);
    this.originalPause = restored ? structuredClone(restored.originalPause) : { ...initialOriginalPause(), depth: scenario.sourceBytes![0x21719] };
    this.setup = restored ? structuredClone(restored.setup) : createSessionSetup(seeds.simulation);
    this.newFarm = restored?.newFarm ? structuredClone(restored.newFarm) : null;
    this.retainedSetup = restored?.retainedSetup ? structuredClone(restored.retainedSetup) : null;
    this.townLayouts = new TownLayouts(townLayouts.bytes);
    this.finances = restored ? copyFinancialState(restored.finances) : readFinancialState(scenario.sourceBytes!);
    this.crops = scenario.cropFiles.map(file => {
      const crop = crops.find(c => `${c.id}.crp` === file);
      if (!crop) throw new Error(`Missing simulation crop ${file}`);
      return [...crop.rawDefinition];
    });
    if (restored) {
      if (restored.townLayoutBytes && this.townLayouts.bytes.some((byte, i) => byte !== restored.townLayoutBytes![i])) {
        throw new Error('Save uses different town layouts; restore the matching original assets.');
      }
      if (this.crops.some((crop, i) => crop.some((byte, j) => byte !== restored.crops[i][j]))) {
        throw new Error('Save uses different crop definitions; restore the matching original assets.');
      }
      this.random = new FarmRandom(restored.random);
      this.cropMarketPrices = [...restored.cropMarketPrices];
      this.market = structuredClone(restored.market);
      this.traffic = createTrafficState(restored.traffic);
      this.weather = { ...restored.weather, forecast: [...restored.weather.forecast], nextForecast: [...restored.weather.nextForecast] };
      this.daysAdvanced = restored.daysAdvanced; this.paused = restored.paused; this.speed = restored.speed;
      this.pendingTown = restored.pendingTown ? { ...restored.pendingTown, site: { ...restored.pendingTown.site } } : null;
      this.elapsed = restored.elapsed; this.dayTicks = restored.dayTicks; this.disasters = structuredClone(restored.disasters);
      this.waterDisasters = { ...restored.waterDisasters };
      this.equipmentRuntime.grassTravelCount = restored.grassTravelCount;
      this.equipmentRuntime.animationTick = restored.equipmentAnimationTick;
      this.aircraftService = { ...restored.aircraftService };
      this.aircraftFlight = restored.aircraftFlight ? { ...restored.aircraftFlight, inputs: [...restored.aircraftFlight.inputs] } : null;
      this.animalFrame = { ...restored.animalFrame, herd: Uint8Array.from(restored.animalFrame.herd) };
    } else {
      if (regionClimate) finalizeRegionFarm(this.scenario, this.finances, this.townLayouts, regionClimate);
      this.random = new FarmRandom(seeds);
      // Crop loading 0x466d0..0x46728 overrides saved crop/seed prices from the loaded definitions.
      this.cropMarketPrices = this.crops.map(c => c[34] | c[35] << 8);
      this.market = createColdMarket(); loadMarketCropPrices(this.market, this.crops);
      this.crops.forEach((c, slot) => {
        this.scenario.cropDefinitions[slot].price = this.cropMarketPrices[slot];
        this.scenario.seedDefinitions[slot].price = Math.max(5, (c[38] | c[39] << 8) >>> 2);
      });
      this.weather = initializeWeather(this.scenario.climate, this.scenario.farm.calendar, this.scenario.farm.precipitationDays, this.random, this.scenario.cells);
      this.traffic = createTrafficState(coldTrafficDefaults());
      initializeStartingTraffic(this.traffic, { regionX: this.scenario.farm.townRegionX, regionY: this.scenario.farm.townRegionY }, this.random);
    }
    this.publish();
  }

  /** Apply the browser catalog policy to a detached restored state, without replay. */
  withAllCrops(catalog: readonly CropDefinition[]): GameSimulation {
    if (this.scenario.cropFiles.length === 24) return this;
    const state = readNativeSave(this.save(null)).state;
    expandCropCatalog(state, catalog);
    return GameSimulation.load(writeNativeSave(state, null), catalog, this.townLayouts).simulation;
  }

  /** Loaded-preset finalization phase. Full geographic entry additionally uses
   * openGeographicRegion for preliminary generation and cold retained clocks. */
  static openRegion(scenario: Scenario, crops: readonly CropDefinition[], townLayouts: TownLayouts, climate: ClimateTables): GameSimulation {
    return new GameSimulation(scenario, crops, townLayouts, undefined, undefined, climate);
  }

  /** Exact native checkpoint, including partial ticks. Does not mutate or advance the farm. */
  save(scenarioId: number | null): string {
    return writeNativeSave({ scenario: this.scenario, setup: this.setup, originalPause: this.originalPause, newFarm: this.newFarm, retainedSetup: this.retainedSetup, crops: this.crops, random: this.random.snapshot(), weather: this.weather,
      daysAdvanced: this.daysAdvanced, paused: this.paused, speed: this.speed, elapsed: this.elapsed, dayTicks: this.dayTicks,
      disasters: this.disasters, waterDisasters: this.waterDisasters, grassTravelCount: this.equipmentRuntime.grassTravelCount,
      equipmentAnimationTick: this.equipmentRuntime.animationTick, cropMarketPrices: this.cropMarketPrices, market: this.market, traffic: snapshotTraffic(this.traffic),
      animalFrame: this.animalFrame, aircraftService: this.aircraftService, aircraftFlight: this.aircraftFlight,
      finances: this.finances, pendingTown: this.pendingTown, townLayoutBytes: [...this.townLayouts.bytes] }, scenarioId);
  }

  static load(text: string, crops: readonly CropDefinition[], townLayouts: TownLayouts): { scenarioId: number | null; simulation: GameSimulation } {
    const { scenarioId, state } = readNativeSave(text);
    return { scenarioId, simulation: new GameSimulation(state.scenario, crops, townLayouts, state.random, state) };
  }

  /** Generate a new farm through the retained restart phases, without reseeding. */
  restartGenerated(options: RestartFarmOptions, assets: NewFarmAssets): GameSimulation {
    const state = restartGeneratedFarm(readNativeSave(this.save(null)).state, options, assets);
    return GameSimulation.load(writeNativeSave(state, null), assets.crops, assets.townLayouts).simulation;
  }

  /** Supplied-farm chooser outcome of the retained restart, not in-game Load. */
  restartRegion(bytes: Uint8Array, climate: ClimateSelection, assets: NewFarmAssets): GameSimulation {
    const state = restartRegionFarm(readNativeSave(this.save(null)).state, bytes, climate, assets);
    return GameSimulation.load(writeNativeSave(state, null), assets.crops, assets.townLayouts).simulation;
  }

  restartGeographic(options: RestartFarmOptions, assets: NewFarmAssets): GameSimulation {
    const state = restartGeographicFarm(readNativeSave(this.save(null)).state, options, assets);
    return GameSimulation.load(writeNativeSave(state, null), assets.crops, assets.townLayouts).simulation;
  }

  static createGeographic(options: NewFarmOptions, assets: NewFarmAssets): GameSimulation {
    return GameSimulation.load(writeNativeSave(createGeographicFarm(options, assets), null), assets.crops, assets.townLayouts).simulation;
  }

  static openGeographicRegion(bytes: Uint8Array, climate: ClimateSelection, seeds: RandomState, assets: NewFarmAssets): GameSimulation {
    return GameSimulation.load(writeNativeSave(createGeographicRegion(bytes, climate, seeds, assets), null), assets.crops, assets.townLayouts).simulation;
  }

  /** Geographic Load/result1, after temporary generated-farm startup. */
  static openOriginalSave(bytes: Uint8Array, options: OriginalStartupOptions, assets: NewFarmAssets): GameSimulation {
    return GameSimulation.load(writeNativeSave(createOriginalSaveStartup(bytes, options, assets), null), assets.crops, assets.townLayouts).simulation;
  }

  restartOriginalSave(bytes: Uint8Array, date: NewFarmOptions['date'], assets: NewFarmAssets): GameSimulation {
    const state = restartOriginalSaveStartup(readNativeSave(this.save(null)).state, bytes, date, assets);
    return GameSimulation.load(writeNativeSave(state, null), assets.crops, assets.townLayouts).simulation;
  }

  /** Import an original SSM into the retained native session, atomically. */
  importOriginal(bytes: Uint8Array, crops: readonly CropDefinition[]): { scenarioId: null; simulation: GameSimulation } {
    const prior = readNativeSave(this.save(null)).state;
    const state = transferOriginalFarm(prior, bytes, crops);
    return { scenarioId: null, simulation: GameSimulation.load(writeNativeSave(state, null), crops, this.townLayouts).simulation };
  }

  /** Validate initialized state through the same checkpoint boundary as loading.
   * No imported-farm initialization, RNG draws or audio are replayed. */
  static createNew(options: NewFarmOptions, assets: NewFarmAssets): GameSimulation {
    const state = createNewFarmState(options, assets);
    return GameSimulation.load(writeNativeSave(state, null), assets.crops, assets.townLayouts).simulation;
  }

  getSnapshot = (): GameSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  subscribeEvents = (listener: (event: GameEvent) => void): (() => void) => {
    this.eventListeners.add(listener);
    return () => { this.eventListeners.delete(listener); };
  };
  private requestMusic(track: Extract<GameEvent, { type: 'music' }>['track'] | null): void {
    if (track) this.events.push({ type: 'music', track });
  }

  private requestAnimalVocals(vocals: readonly AnimalVocal[]): void {
    for (const vocal of vocals) this.events.push({ type: 'sound', sound: vocal.slice(0, -4) as AnimalSound });
  }

  private requestCollisionSounds(): void {
    for (const notice of this.equipmentRuntime.notices) if (notice.type === 'animal-hit') {
      // 0x133d5/0x1357e both request smack.voc, at DS230e/DS2318.
      this.events.push({ type: 'sound', sound: 'smack' }, { type: 'sound', sound: 'smack' });
    }
    this.equipmentRuntime.notices.length = 0;
  }

  dispatch(command: GameCommand): void {
    // External input, not checkpoint state. Clearing remains available while
    // modal decisions suspend gameplay; no redraw or simulation step is needed.
    if (command.type === 'set-map-pointer') {
      const p = command.pointer;
      if (p && (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= 96 || p.y >= 96))
        throw new Error('Invalid map pointer');
      this.mapPointer = p ? { x: p.x, y: p.y } : null;
      return;
    }
    if (command.type === 'set-option') {
      if (!['autoBuySeeds','autoRent','autoClear','autoScroll','autoGoto','messages'].includes(command.option) || typeof command.enabled !== 'boolean') throw new Error('Invalid farm option');
      this.scenario.farm[command.option] = command.enabled; this.publish(); return;
    }
    if (command.type === 'choose-town') {
      const pending = this.pendingTown;
      if (!pending) return;
      this.lastTownResult = resolveTownChoice(this.scenario, this.finances.town, this.townLayouts,
        pending.site, command.choice, this.random);
      if (this.lastTownResult.ok) {
        this.pendingTown = null;
        this.finishYear();
        this.finishWeek(this.scenario.farm.calendar, true);
        this.finishDay(this.scenario.farm.calendar);
        this.paused = !pending.resumeRunning; this.elapsed = 0;
      }
      this.publish(); return;
    }
    if (this.pendingTown) return; // Modal choice suspends all other farm commands.
    if (command.type === 'resolve-default') {
      if (this.finances.defaultDecision?.status !== 'pending') return;
      resolveDefaultDecision(this.finances.defaultDecision, command.choice);
      this.publish(); return;
    }
    if (this.finances.defaultDecision) return; // Terminal choice/end state freezes every gameplay command.
    if (this.aircraftFlight && !['flight-control', 'step-flight', 'set-paused', 'set-speed'].includes(command.type)) return;
    if (command.type === 'start-flight') {
      const result = beginFlight(this.scenario, this.finances, command.slot, command.columns, command.rows,
        this.weather.soilMoisture, this.paused);
      this.lastFlightStartResult = result.ok ? { ok: true } : result;
      if (result.ok) { this.aircraftFlight = result.flight; this.lastFlightEnd = null; this.paused = false; this.elapsed = 0; }
    } else if (command.type === 'flight-control') {
      if (!this.aircraftFlight) return;
      if (!FLIGHT_CONTROLS.includes(command.control)) throw new Error('Invalid flight control');
      if (this.aircraftFlight.inputs.length >= MAX_FLIGHT_INPUTS) return;
      this.aircraftFlight.inputs.push(command.control);
    } else if (command.type === 'step-flight') {
      if (!this.aircraftFlight || !this.paused) return;
      for (let i = 0; i < 2 && this.aircraftFlight; i++) this.advanceTick();
    } else if (command.type === 'borrow') {
      this.lastLoanResult = { kind: 'borrow', ...borrowLoan(this.scenario, this.finances.loan,
        this.finances.accounts.buildingBookValue, this.finances.loanRate, command.amount, this.weather.soilMoisture) };
    } else if (command.type === 'repay-loan') {
      this.lastLoanResult = { kind: 'repay', ...repayLoanInFull(this.scenario.farm, this.finances.loan, loanPaymentAccounts(this.finances)) };
    } else if (command.type === 'set-paused') {
      if (this.paused === command.paused) return;
      this.paused = command.paused; this.elapsed = 0;
    } else if (command.type === 'set-speed') {
      if (!SIMULATION_SPEEDS.some(speed => speed === command.speed)) throw new Error('Invalid simulation speed');
      if (this.speed === command.speed) return;
      this.speed = command.speed;
    } else if (command.type === 'edit-field-plan') {
      this.lastPlanEditResult = { ...editFieldPlan(this.scenario, this.crops, command.fieldSlot, command.week, command.action),
        fieldSlot: command.fieldSlot, week: command.week };
      if(!this.lastPlanEditResult.ok&&this.lastPlanEditResult.reason==='fixed-harvest-week')
        this.events.push({type:'field-notice',id:'fixed-harvest-week'});
    } else if (command.type === 'disaster-menu') {
      if (command.action === 'disable') this.disasters.enabled = !this.disasters.enabled;
      else {
        if (!(DISASTER_MENU_KINDS as readonly string[]).includes(command.action)) throw new Error('Invalid disaster menu action');
        const enabled = this.disasters.enabled;
        // SF-171: the original enables after the guarded call, producing phantom
        // checks. An explicit native menu request enables before starting.
        this.disasters.enabled = true;
        this.lastDisasterResult = this.startRequestedDisaster(command.action);
        // Source Locusts alone leaves enable/check state alone after failure.
        if (command.action === 'swarm' && !this.lastDisasterResult.ok) this.disasters.enabled = enabled;
      }
    } else if (command.type === 'start-disaster') {
      if (!['tornado', 'swarm', 'drought', 'flood', 'frost', 'crop-circles', 'toxic-land', 'wind'].includes(command.kind)) throw new Error('Invalid disaster kind');
      this.lastDisasterResult = this.startRequestedDisaster(command.kind);
    } else if (command.type === 'set-disasters-enabled') {
      this.disasters.enabled = command.enabled;
    } else if (command.type === 'set-auto-clear') {
      this.scenario.farm.autoClear = command.enabled;
    } else if (command.type === 'buy-land') {
      this.lastLandResult = purchaseLand(this.scenario, command.regionX, command.regionY, this.weather.soilMoisture);
    } else if (command.type === 'sell-land') {
      this.lastLandSaleResult = sellManualLand(this.scenario, this.finances, command.regionX, command.regionY, this.weather.soilMoisture);
    } else if (command.type === 'build') {
      this.lastBuildingResult = purchaseBuilding(this.scenario, this.finances, command.buildingType, command.x, command.y, this.weather.soilMoisture);
    } else if (command.type === 'move-supply') {
      this.lastSupplyMoveResult = moveManualSupply(this.scenario, this.finances, command.selected, command.x, command.y, this.weather.soilMoisture);
    } else if (command.type === 'move-equipment') {
      this.lastEquipmentMoveResult = moveManualEquipment(this.scenario, command.selected, command.x, command.y, this.scenario.farm.timerTicks);
      // Original13c86 uses the wrong text index62; SF-173 retains evidence.
      if(!this.lastEquipmentMoveResult.ok&&this.lastEquipmentMoveResult.reason==='equipment-busy')appendEditStatus(this.editStatus,61);
    } else if (command.type === 'toggle-building-interior') {
      this.lastBuildingInteriorResult = toggleManualBuildingInterior(this.scenario, command.x, command.y, command.slot);
    } else if (command.type === 'remove-object') {
      this.lastRemovalResult = removeManualTarget(this.scenario, this.finances, command.x, command.y, command, this.weather.soilMoisture, this.random);
      if (this.lastRemovalResult.ok) this.events.push({ type: 'sound', sound: this.lastRemovalResult.kind === 'terrain' ? 'bulldoze' : 'explode' });
    } else if (command.type === 'plant-tree') {
      this.lastTreeResult = placeTree(this.scenario, this.finances, this.random, command.x, command.y, this.weather.soilMoisture);
      if (this.lastTreeResult.ok) this.events.push({ type: 'sound', sound: 'plopitem' }, { type: 'sound', sound: 'ploptool' });
      else this.events.push({ type: 'sound', sound: 'uhoh' });
    } else if (command.type === 'network') {
      this.lastNetworkResult = { tool: command.tool, ...placeNetwork(this.scenario, this.finances, command.tool, command.x, command.y, this.weather.soilMoisture) };
      if (command.tool !== 'open-gate' && command.tool !== 'close-gate')
        this.events.push({ type: 'sound', sound: this.lastNetworkResult.ok ? 'ploptool' : 'uhoh' });
    } else if (command.type === 'irrigation') {
      this.lastIrrigationResult = placeIrrigation(this.scenario, this.finances, command.tool, command.x, command.y, this.weather.soilMoisture);
      if(command.tool==='ditch'||command.tool==='valve')
        this.events.push({type:'sound',sound:this.lastIrrigationResult.ok?'ploptool':'uhoh'});
    } else if (command.type === 'toggle-valve') {
      this.lastIrrigationResult = toggleMapValve(this.scenario,command.x,command.y);
    } else if (command.type === 'buy-aircraft') {
      this.lastAircraftPurchaseResult = purchaseAircraft(this.scenario, this.finances);
    } else if (command.type === 'service-aircraft') {
      this.lastAircraftServiceResult = serviceAircraft(this.scenario, this.finances, this.aircraftService, command.slot, command.action);
    } else if (command.type === 'buy-crop-supply') {
      this.lastCropSupplyPurchaseResult = { productType: command.productType,
        ...purchaseCropSupply(this.scenario, command.productType, command.x, command.y, this.weather.soilMoisture) };
      if (this.lastCropSupplyPurchaseResult.ok) {
        this.events.push({ type: 'sound', sound: 'plopitem' }, { type: 'sound', sound: 'ploptool' });
      } else this.events.push({ type: 'sound', sound: 'uhoh' });
    } else if (command.type === 'buy-equipment') {
      this.lastEquipmentPurchaseResult = { equipmentType: command.equipmentType,
        ...purchaseEquipment(this.scenario, this.finances, command.equipmentType, command.x, command.y, this.weather.soilMoisture) };
    } else if (command.type === 'buy-livestock') {
      this.lastLivestockResult = { productType: command.productType,
        ...purchaseLivestock(this.scenario, this.finances, this.random, command.productType, command.x, command.y, this.weather.soilMoisture) };
      if (command.productType === 299 || command.productType === 300) {
        if (this.lastLivestockResult.ok) this.events.push({ type: 'sound', sound: 'plopitem' }, { type: 'sound', sound: 'ploptool' });
        else this.events.push({ type: 'sound', sound: 'uhoh' });
      }
    } else if(command.type==='edit-status'){
      if(!isEditToolStatus(command.code))throw new Error('Invalid Edit tool status');
      appendEditStatus(this.editStatus,command.code);
    } else if (command.type === 'create-field') {
      this.lastPlantResult = null; this.lastHarvestResult = null;
      this.lastNewFieldResult = plantNewField(this.scenario, command.x, command.y, command.cropSlot, this.crops,
        this.market, this.random, this.weather.soilMoisture);
      if (this.lastNewFieldResult.ok) {
        this.lastPlantResult = this.lastNewFieldResult;
        recordFieldPlanOrder(this.scenario, this.crops, this.lastNewFieldResult.slot, { kind: 'plant', cropSlot: command.cropSlot });
      } else appendEditStatus(this.editStatus,51);
    } else if (command.type === 'treat-field') {
      this.lastTreatmentResult = orderTreatment(this.scenario, command.fieldSlot, command.treatment, this.weather.soilMoisture);
      if (this.lastTreatmentResult.ok) {
        recordFieldPlanOrder(this.scenario, this.crops, command.fieldSlot, { kind: command.treatment });
        appendEditStatus(this.editStatus,68); // Original26f8e clears the current prompt.
      } else if(this.lastTreatmentResult.reason==='field-busy')appendEditStatus(this.editStatus,21);
      else if(this.lastTreatmentResult.reason==='no-supplies'||this.lastTreatmentResult.reason==='insufficient-funds')appendEditStatus(this.editStatus,75);
      // Native invalid-input/inconsistent-stock guards have no verified source message.
    } else if (command.type === 'plant-field') {
      this.lastHarvestResult = null;
      this.lastPlantResult = plantField(this.scenario, command.fieldSlot, command.cropSlot, this.crops,
        this.market, this.random, this.weather.soilMoisture);
      if (this.lastPlantResult.ok) recordFieldPlanOrder(this.scenario, this.crops, command.fieldSlot, { kind: 'plant', cropSlot: command.cropSlot });
    } else if (command.type === 'harvest-field') {
      this.lastPlantResult = null;
      this.lastHarvestResult = orderHarvest(this.scenario, command.fieldSlot, this.crops);
    } else if (command.type === 'sell-asset') {
      this.lastAssetSaleResult = { kind: command.kind, ...sellManualAsset(this.scenario, this.finances, command.kind, command.slot, this.weather.soilMoisture) };
    } else if (command.type === 'sell-harvest') {
      this.lastSaleResult = sellStoredHarvest(this.scenario, command.inventorySlot, this.weather.soilMoisture);
    } else {
      const remaining = ticksUntilCalendarDay(this.dayTicks, this.scenario.farm.dayDelayTicks);
      if (remaining === null) return; // SF-154: no u16 phase can exceed FFFF.
      for (let i = 0; i < remaining; i++) this.advanceTick();
    }
    this.publish();
  }

  /** Native pacing: at1x an advancing calendar takes four seconds per full
   * day. The maximum delay still runs logical ticks but cannot advance a day.
   * Original interrupt frequency/menu timing is not claimed here. */
  tick(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('Invalid elapsed time');
    if (this.paused) return;
    this.elapsed += milliseconds * this.speed * (this.scenario.farm.dayDelayTicks + 1) / 4000;
    const ticks = Math.floor(this.elapsed + 1e-9);
    if (!ticks) return;
    this.elapsed = Math.max(0, this.elapsed - ticks);
    for (let i = 0; i < ticks && !this.paused; i++) this.advanceTick();
    this.publish();
  }

  private advanceTick(): void {
    if (this.finances.defaultDecision || this.pendingTown) return;
    const s = this.scenario, tick = s.farm.timerTicks = (s.farm.timerTicks + 1) & 0xffff;
    s.farm.animationTicks = (s.farm.animationTicks + 1) & 0xffff;
    if (this.aircraftFlight) {
      const flight = this.aircraftFlight;
      const result = advanceFlight(s, this.finances, this.crops, flight, s.farm.animationTicks, this.disasters.flags & 1 ? this.disasters.tornado : null);
      if (result.advanced && (this.disasters.flags & 1)) this.advanceDisasters(); // Modal source call0x31730.
      if (result.advanced) this.events.push({ type: 'sound', sound: 'plane' }); // Original request0x3107e, before next frame.
      if (result.end) {
        this.lastFlightEnd = result.end; this.aircraftFlight = null; this.paused = flight.resumePaused;
        if (this.paused) this.elapsed = 0;
      }
      return; // Original modal loop suspends ordinary calendar, machinery, clearing, irrigation and animals.
    }
    this.equipmentRuntime.animationTick = s.farm.animationTicks;
    // Dispatcher 0xbcc8 precedes machinery/calendar. The native Pause control
    // freezes logical animation ticks as well as simulation time.
    updateClearingEffects(s, this.finances.clearing, this.weather.soilMoisture, s.farm.animationTicks);
    const allocate = (world: Scenario, type: number, x: number, y: number) => reserveEquipment(world, type, x, y, tick);
    updateEquipment(s, this.equipmentRuntime, tick, s.farm.paceEquipment, allocate);
    for (const field of s.fields) {
      if (!updatePlantingField(field, this.crops[field.cropSlot], s, this.equipmentRuntime, tick, allocate)) break;
      updateHarvestField(field, this.crops[field.cropSlot], s, this.equipmentRuntime, tick, this.random, allocate);
      if (!updateTreatmentField(field, this.crops[field.cropSlot], s, this.equipmentRuntime, tick, this.weather.soilMoisture, allocate)) break;
    }
    this.requestCollisionSounds();
    this.dayTicks = (this.dayTicks + 1) & 65535;
    if (calendarDayDue(this.dayTicks, s.farm.dayDelayTicks)) { this.dayTicks = 0; this.advanceDay(); }
    // 0xbd42 follows the calendar and equipment calls. Modal decisions suspend
    // the remaining work; native Pause freezes the same logical animation clock.
    if (!this.finances.defaultDecision && !this.pendingTown) updateIrrigation(s, s.irrigation, s.farm.animationTicks, this.weather.wind, status => {
      for (const field of s.fields) if (field.active) {
        updateFieldWater(field, s.cells, this.weather.soilMoisture, this.disasters.flags);
        if (status) updateFieldStatus(field, this.crops[field.cropSlot], s.cells);
      }
    });
    if (!this.finances.defaultDecision && !this.pendingTown) {
      const animals = advanceAnimalFrame(s, this.finances, { tick: s.farm.animationTicks, frame: this.animalFrame,
        random: this.random, crops: this.crops, pointer: this.mapPointer }, this.weather.soilMoisture);
      for (const animal of animals) this.requestAnimalVocals(animal.movement?.sounds ?? []);
      const notices = animals.flatMap(a => [...(a.movement?.notices ?? []), ...(a.care?.notices ?? [])]
        .map(id => ({ slot: a.slot, id, animalType: s.animals[a.slot].type })));
      if (notices.length) this.animalNotices = notices.slice(-20);
      advanceTraffic(s, this.traffic, this.random, this.equipmentRuntime); // Main0xbd73, after animals and before disasters.
      this.requestCollisionSounds();
      this.advanceDisasters(); // Main-loop0xbd85.
    }
  }

  private advanceDay(): void {
    const s = this.scenario, w = this.weather, before = s.farm.calendar;
    this.random.nextSimulation(); // Calendar entry 0xc899; additional DOS frame/UI consumers are not reproduced.
    const next = advanceCalendarDay(before);
    // 0xd1ae runs after incrementing day but BEFORE wrapping day seven to zero.
    if (advanceFrostDay(w, this.disasters)) this.disasterNotice('The frost has ended.');
    if ((before.day + 1) & 1) {
      for (const field of s.fields.filter(f => f.active)) {
        const crop = this.crops[field.cropSlot];
        changeFieldCondition(field, crop, s.regionalConditions, 1, 1);
        changeFieldCondition(field, crop, s.regionalConditions, 2, 2);
        updateFieldStatus(field, crop, s.cells);
      }
      increaseAnimalNeeds(s, w.displayTemperature); // 0xd28b reads prior DS43dc; daily display refresh is later at0xd0cc.
      fillWaterStorage(s); // 0xd296, before the day-seven weekly phase and next irrigation frame.
    }
    if (next.weekEnded) {
      allocateTraffic(this.traffic, s.farm.townRegionX * 8, s.farm.townRegionY * 8, 0, this.random); // Weekly0xbdf0..0xbe0e.
      advanceFloodCounter(this.disasters, this.waterDisasters); // Weekly0xbe38, before natural requests.
      // Weekly0xbe42: July's random requests precede aging and wind update.
      if (before.month === 6) {
        if ((this.random.nextSimulation() & 127) === 49) this.startWind();
        else if ((this.random.nextSimulation() & 255) === 55) this.startDisaster('tornado');
        if ((this.random.nextSimulation() & 63) === 33) this.startDisaster('swarm');
      }
      // Remaining0x364b0 branches use old-week moisture and the updated counter.
      if (w.soilMoisture > 13 && this.waterDisasters.counter === 0) this.startWaterDisaster('flood');
      if (w.soilMoisture < 0) this.startWaterDisaster('drought');
      if ((this.disasters.flags & 4) && w.soilMoisture <= 9 && this.waterDisasters.counter > 3) this.stopWater('flood');
      if ((this.disasters.flags & 2) && w.soilMoisture >= 3) this.stopWater('drought');
      // Weekly0xbe4d: equipment, buildings, chemicals, animals, inventory;
      // every aging phase precedes wind0xbe74 and breeding0xbe81.
      const equipment = ageEquipment(s, this.finances, w.soilMoisture);
      this.equipmentAgingNotices = [...this.equipmentAgingNotices, ...equipment].slice(-20);
      for (const result of equipment) if (result.kind === 'sold') this.events.push({ type: 'sound', sound: 'explode' });
      ageBuildings(s, this.random);
      ageChemicals(s);
      const aging = ageAnimals(s, this.finances, this.random);
      this.requestAnimalVocals(aging.sounds);
      this.animalLifecycleNotices = [...this.animalLifecycleNotices, ...aging.notices].slice(-20);
      ageInventoryAndRefillTroughs(s);
      updateWeeklyMarket(s, this.crops, this.market, this.random, new FarmRandom(this.random.snapshot())); // 0xbe55, before wind and scheduled planting.
      for (let i = 0; i < this.crops.length; i++) this.cropMarketPrices[i] = s.cropDefinitions[i].price;
      // Weekly dispatcher0xbdbe updates old week's wind and field water before the calendar rolls.
      const wind = updateWeeklyWind(w, s.climate, before);
      if (wind.storm) this.startWind();
      if (wind.tornado) this.startDisaster('tornado');
      if (w.wind < 70 && stopMovingDisaster(this.disasters, 'tornado', s.farm.animationTicks)) {
        this.disasterMessage('tornado-ended');
        this.disasterNotice('The tornado has passed.');
      }
      if (!wind.storm && (this.disasters.flags & 8)) {
        this.disasters.flags &= ~8;
        this.disasterMessage('wind-ended');
      }
      this.animalLifecycleNotices = [...this.animalLifecycleNotices, ...advanceAnimalGestation(s, this.finances, this.random)].slice(-20); // 0xbe81.
      this.requestMusic(updateReportedFieldStatus(s, this.finances.statistics)); // 0xbe8b, before water/status dispatch 0xbea3.
      for (const field of s.fields.filter(f => f.active)) {
        updateFieldWater(field, s.cells, w.soilMoisture, this.disasters.flags);
        updateFieldStatus(field, this.crops[field.cropSlot], s.cells);
      }
      // 0xc920 increments week; 0xcbbd dispatches before 0xcc10 normalizes month/week.
      // At year-end this executes old plan row 48 and completes the final week's work.
      s.farm.calendar = { ...before, day: 0, week: before.week + 1, season: next.calendar.season };
      developTown(s, this.finances.town, this.townLayouts, w.soilMoisture, this.random); // 0xcbb3, before field orders.
      this.lastScheduleResult = dispatchFieldSchedule(s, this.crops, this.market, this.random, this.equipmentRuntime, w.soilMoisture);
      // 0xcbc6 indexes temperature before month/year rollover. Index 240 aliases DS:4368 (wind).
      const index = w.temperatureYear * 48 + before.month * 4 + before.week + 1;
      w.temperature = index === 240 ? w.wind : s.climate.temperature[index];
      if (next.monthEnded) {
        this.random.mixMonth(before.month + 1);
        const retry = retryMonthlyDebts(s, this.finances.accounts, this.finances.debt, this.finances.clearing,
          w.soilMoisture, before.month + 1, id=>{if(id>=128||this.scenario.farm.messages)this.events.push({type:'finance-notice',id});});
        this.financeNotices = retry.notices;
        if (retry.pendingDefault) {
          this.finances.defaultDecision = retry.pendingDefault.decision;
          this.paused = true; this.elapsed = 0;
          // Terminal source flow exits/restarts. Normalize the frozen date for
          // valid native checkpoints; no later simulation phase can resume it.
          s.farm.calendar = next.calendar; this.daysAdvanced++; return;
        }
      }
      if (next.yearEnded) {
        this.lastTaxSettlement = settleAnnualTax(s, w.soilMoisture, taxAccounts(this.finances)); // 0xcdf4.
        if (!this.lastTaxSettlement.paid) { this.financeNotices.push(159); this.events.push({type:'finance-notice',id:159}); }
        const site = this.lastTaxSettlement.offerExpansion ? beginTownExpansion(s, this.finances.town) : null;
        if (site) {
          this.finances.town.activeSite = { ...site }; // 0x3c03f/0x3c04a, before chooser.
          this.pendingTown = { phase: 'annual-reset', site, resumeRunning: !this.paused };
          this.lastTownResult = null;
          this.paused = true; this.elapsed = 0;
          s.farm.calendar = next.calendar;
          return; // Remaining day/annual phases resume exactly once after construction.
        }
        this.finishYear();
      }
      this.finishWeek(next.calendar, next.monthEnded);
    }
    this.finishDay(next.calendar);
  }

  private finishYear(): void {
    const s = this.scenario, w = this.weather;
    resetAnnualLedgers(s.farm, this.finances.accounts, this.finances.annual, w); // 0xcdf9.
    projectFieldScheduleYear(s, this.crops); // 0xcdfe, after old row 48 and collection/choice.
    this.requestMusic(updateAnnualStatistics(s, this.finances.statistics, this.finances.accounts.assets.equipmentBookValue,
      this.finances.accounts.buildingBookValue, this.finances.loan.principal, w.soilMoisture)); // 0xce0e/0xce13.
    this.lastHomesteadChange = updateHomestead(s.cells, this.finances.homestead, s.farm.cash); // 0xcf14.
    if (this.lastHomesteadChange?.sound) this.events.push({ type: 'sound', sound: this.lastHomesteadChange.sound });
    this.requestMusic(this.lastHomesteadChange?.music ?? null);
    this.finances.loanRate = (this.random.nextSimulation() & 7) + 8; // 0xcfa6..0xcfbc.
    w.temperatureYear = (w.temperatureYear + 1) % 5;
    w.precipitationYear = (w.precipitationYear + 1) % 5;
    w.windYear = (w.windYear + 1) % 5;
  }

  private disasterMessage(id:DisasterNoticeId):void {
    if(DISASTER_MESSAGES[id].mandatory||this.scenario.farm.messages)this.events.push({type:'disaster-notice',id});
  }

  private disasterNotice(text: string): void { if (!this.scenario.farm.messages) return; this.disasterNotices = [...this.disasterNotices, text].slice(-8); }

  private startRequestedDisaster(kind: Extract<GameCommand, {type:'start-disaster'}>['kind']) {
    return kind === 'wind' ? this.startWind() : kind === 'drought' || kind === 'flood' ? this.startWaterDisaster(kind)
      : kind === 'tornado' || kind === 'swarm' ? this.startDisaster(kind) : this.startStationaryDisaster(kind);
  }

  private startDisaster(kind: MovingDisasterKind): MovingDisasterStart {
    const result = beginMovingDisaster(this.scenario, this.disasters, kind, this.scenario.farm.animationTicks, this.random);
    if (result.ok) {
      this.disasterMessage(kind);
      this.disasterNotice(kind === 'tornado' ? 'A tornado has formed. Buildings and crops are at risk.' : 'Locusts have descended on a field.');
      this.events.push({ type: 'sound', sound: kind });
      if (this.scenario.farm.autoGoto) {
        const target = this.disasters[kind];
        this.events.push({ type: 'map-focus', x: target.x, y: target.y });
      }
    }
    return result;
  }
  private startStationaryDisaster(kind: StationaryDisasterKind): StationaryDisasterStart {
    const result = beginStationaryDisaster(this.scenario, this.crops, this.market, this.weather,
      this.disasters, kind, this.scenario.farm.animationTicks, this.random);
    if (result.ok) {
      this.disasterMessage(kind);
      if (kind === 'frost') {
        if (result.cancelledSwarm) this.disasterNotice('The frost has dispersed the locust swarm.');
        this.disasterNotice(`Frost has begun, damaging ${result.fields.length} sensitive field${result.fields.length === 1 ? '' : 's'}.`);
        this.events.push({ type: 'sound', sound: 'wind' });
      } else if (kind === 'crop-circles') {
        this.disasterNotice(`Crop circles have appeared in field ${this.scenario.fields[result.fields[0]].number}.`);
        this.requestMusic('alien');
      } else this.disasterNotice('A toxic-land warning has been recorded.');
    }
    return result;
  }
  private startWind(): Exclude<GameSnapshot['lastDisasterResult'], null> {
    if (beginWindDisaster(this.scenario, this.crops, this.market, this.weather, this.disasters, this.scenario.farm.animationTicks)) {
      this.disasterMessage('wind');
      this.disasterNotice('High winds are stripping nutrients from fields without enough nearby trees.');
      this.events.push({ type: 'sound', sound: 'wind' });
      return { ok: true, kind: 'wind' };
    }
    return { ok: false, reason: this.disasters.enabled ? 'already-active' : 'disabled' };
  }
  private startWaterDisaster(kind: WaterDisasterKind): Exclude<GameSnapshot['lastDisasterResult'], null> {
    const started = beginWaterDisaster(this.scenario, this.crops, this.market, this.weather,
      this.disasters, this.waterDisasters, kind, this.scenario.farm.animationTicks, this.random);
    if (!started) return { ok: false, reason: this.disasters.enabled ? 'already-active' : 'disabled' };
    this.disasterMessage(kind);
    this.disasterNotice(kind === 'flood' ? 'Floodwater is spreading beside permanent water. Fields and buildings are at risk.' : 'Drought has dried shallow water along the shoreline.');
    if (kind === 'flood') this.events.push({ type: 'sound', sound: 'flood' });
    return { ok: true, kind };
  }
  private stopWater(kind: WaterDisasterKind): void {
    if (stopWaterDisaster(this.scenario, this.weather, this.disasters, this.waterDisasters, kind, this.random)) {
      this.disasterMessage(kind === 'flood' ? 'flood-ended' : 'drought-ended');
      this.disasterNotice(kind === 'flood' ? 'The floodwater has receded.' : 'The drought has ended.');
    }
  }
  private advanceDisasters(): void {
    const s = this.scenario;
    if (advanceStationaryDisasters(this.weather, this.disasters).includes('frost')) this.disasterNotice('The frost has ended.');
    advanceWindDisaster(s, this.crops, this.disasters.flags, s.farm.animationTicks, this.disasters.windReferenceTick, s.farm.dayDelayTicks);
    const step = advanceMovingDisasters(s, this.finances, this.disasters, s.farm.animationTicks, this.weather.soilMoisture, this.random);
    if (step.swarmEnded) this.disasterNotice('The locust swarm has dispersed.');
    if (step.hits.some(h => !h.result.ok && h.result.reason === 'insufficient-cash')) this.disasterNotice('Insufficient cash for disaster terrain clearing ($25).');
    const flood = advanceFlood(s, this.finances, this.weather, this.disasters, this.waterDisasters, this.random);
    for (const slot of flood.fields) {
      this.disasterNotice(`Floodwater destroyed field ${s.fields[slot].number}.`);
      this.events.push({ type: 'sound', sound: 'explode' });
    }
    for (const slot of flood.buildings) {
      this.disasterNotice(`Floodwater destroyed a building at ${s.buildings[slot].x}, ${s.buildings[slot].y}.`);
      this.events.push({ type: 'sound', sound: 'explode' });
    }
    if (flood.ended) {this.disasterMessage('flood-ended');this.disasterNotice('The floodwater has receded.');}
  }

  private finishWeek(calendar: FarmCalendar, monthEnded: boolean): void {
    const s = this.scenario, w = this.weather;
    if (monthEnded && isLoanPaymentMonth(calendar.month)) {
      const payment = payScheduledLoan(s.farm, this.finances.loan, this.finances.debt, loanPaymentAccounts(this.finances));
      if (payment.notice) { this.financeNotices.push(payment.notice); this.events.push({type:'finance-notice',id:payment.notice}); }
    }
    if (monthEnded) beginAnimalPregnancies(s); // 0xd032, skipped by non-month-ending weeks.
    w.windAnomaly = Math.max(0, w.windAnomaly - 2);
    advanceForecast(w, s.climate, calendar, this.random, s.cells);
  }

  private finishDay(calendar: FarmCalendar): void {
    const s = this.scenario, w = this.weather;
    s.farm.calendar = calendar;
    w.displayTemperature = (w.temperature + this.random.below(5)) << 24 >> 24;
    applyDailyWeather(w, calendar.day);
    s.farm.precipitationDays = w.precipitationDays;
    for (const field of s.fields.filter(f => f.active)) updateGrowingField(field, this.crops[field.cropSlot], {
      week: calendar.week, temperature: w.temperature << 16 >> 16, regions: s.regionalConditions, cells: s.cells, random: this.random,
    });
    this.daysAdvanced++;
  }

  private publish(): void {
    this.requestCollisionSounds(); // Includes any collision from a direct machinery command.
    // Read-only current view: keep the saved original report cache separate
    // until all of its annual consumers and lifecycle are reconstructed.
    const report = { ...this.finances.annual };
    updateAnnualReport(this.scenario.farm, this.finances.accounts, report);
    const creditLimit = loanCreditLimit(this.scenario, this.finances.accounts.buildingBookValue, this.finances.loan.principal, this.weather.soilMoisture);
    this.snapshot = { setup: structuredClone(this.setup), retainedSetup: this.retainedSetup ? structuredClone(this.retainedSetup) : null, newFarm: this.newFarm ? structuredClone(this.newFarm) : null, traffic: snapshotTraffic(this.traffic), disasters: structuredClone(this.disasters), waterDisasters: { ...this.waterDisasters }, lastDisasterResult: this.lastDisasterResult ? structuredClone(this.lastDisasterResult) : null,
      editStatuses:recentEditStatuses(this.editStatus), disasterNotices: [...this.disasterNotices], revision: (this.snapshot?.revision ?? -1) + 1, scenario: copyScenario(this.scenario),
      farmReport: { income: report.reportIncome, expenses: report.reportExpenses, net: report.reportNet,
        fields: summarizeFieldStatus(this.scenario.fields, this.scenario.farm.cash) },
      finances: copyFinancialState(this.finances),
      pendingTown: this.pendingTown ? { ...this.pendingTown, site: { ...this.pendingTown.site } } : null,
      lastTownResult: this.lastTownResult ? this.lastTownResult.ok
        ? { ...this.lastTownResult, site: { ...this.lastTownResult.site } } : { ...this.lastTownResult } : null,
      lastHomesteadChange: this.lastHomesteadChange ? { ...this.lastHomesteadChange } : null,
      taxAssessment: assessAnnualTax(this.scenario, this.weather.soilMoisture, this.finances.debt.unpaidTaxes),
      lastTaxSettlement: this.lastTaxSettlement ? { ...this.lastTaxSettlement, assessment: { ...this.lastTaxSettlement.assessment } } : null,
      loanCreditLimit: creditLimit,
      availableLoan: Math.min(Math.max(0, 9999999 - this.scenario.farm.cash), creditLimit),
      lastLoanResult: this.lastLoanResult ? { ...this.lastLoanResult } : null, financeNotices: [...this.financeNotices],
      aircraftService: { ...this.aircraftService },
      aircraftFlight: this.aircraftFlight ? { ...this.aircraftFlight, inputs: [...this.aircraftFlight.inputs] } : null,
      lastFlightStartResult: this.lastFlightStartResult ? { ...this.lastFlightStartResult } : null,
      lastFlightEnd: this.lastFlightEnd ? { ...this.lastFlightEnd } : null,
      lastAircraftPurchaseResult: this.lastAircraftPurchaseResult ? { ...this.lastAircraftPurchaseResult } : null,
      lastAircraftServiceResult: this.lastAircraftServiceResult ? { ...this.lastAircraftServiceResult } : null,
      animalFrame: { ...this.animalFrame, herd: Uint8Array.from(this.animalFrame.herd) },
      animalNotices: this.animalNotices.map(n => ({ ...n })),
      animalLifecycleNotices: this.animalLifecycleNotices.map(n => ({ ...n })),
      equipmentAgingNotices: this.equipmentAgingNotices.map(n => ({ ...n })),
      weather: { ...this.weather, forecast: [...this.weather.forecast], nextForecast: [...this.weather.nextForecast] },
      daysAdvanced: this.daysAdvanced, paused: this.paused, speed: this.speed, originalPause: structuredClone(this.originalPause), cropMarketPrices: [...this.cropMarketPrices], market: structuredClone(this.market),
      lastPlantResult: this.lastPlantResult ? { ...this.lastPlantResult } : null,
      lastHarvestResult: this.lastHarvestResult ? { ...this.lastHarvestResult } : null,
      lastSaleResult: this.lastSaleResult ? { ...this.lastSaleResult } : null,
      lastAssetSaleResult: this.lastAssetSaleResult ? { ...this.lastAssetSaleResult } : null,
      lastSupplyMoveResult: this.lastSupplyMoveResult ? { ...this.lastSupplyMoveResult } : null,
      lastEquipmentMoveResult: this.lastEquipmentMoveResult ? { ...this.lastEquipmentMoveResult } : null,
      lastBuildingInteriorResult: this.lastBuildingInteriorResult ? { ...this.lastBuildingInteriorResult } : null,
      lastRemovalResult: this.lastRemovalResult ? { ...this.lastRemovalResult } : null,
      lastLandResult: this.lastLandResult ? { ...this.lastLandResult } : null,
      lastLandSaleResult: this.lastLandSaleResult ? { ...this.lastLandSaleResult, ...(this.lastLandSaleResult.ok ? { demolishedBuildings: [...this.lastLandSaleResult.demolishedBuildings] } : {}) } : null,
      lastCropSupplyPurchaseResult: this.lastCropSupplyPurchaseResult ? { ...this.lastCropSupplyPurchaseResult } : null,
      lastEquipmentPurchaseResult: this.lastEquipmentPurchaseResult ? { ...this.lastEquipmentPurchaseResult } : null,
      lastBuildingResult: this.lastBuildingResult ? { ...this.lastBuildingResult } : null,
      lastTreeResult: this.lastTreeResult ? { ...this.lastTreeResult } : null,
      lastNetworkResult: this.lastNetworkResult ? { ...this.lastNetworkResult } : null,
      lastIrrigationResult: this.lastIrrigationResult ? { ...this.lastIrrigationResult } : null,
      lastLivestockResult: this.lastLivestockResult ? { ...this.lastLivestockResult } : null,
      lastNewFieldResult: this.lastNewFieldResult ? { ...this.lastNewFieldResult } : null,
      lastTreatmentResult: this.lastTreatmentResult ? { ...this.lastTreatmentResult } : null,
      lastScheduleResult: this.lastScheduleResult ? { ...this.lastScheduleResult } : null,
      lastPlanEditResult: this.lastPlanEditResult ? { ...this.lastPlanEditResult } : null,
      storedHarvestValues: this.scenario.inventory.map(i => i.active && i.type >= 168 && i.type < 168 + this.crops.length
        ? storedHarvestValue(i, this.scenario) : null),
      fieldHarvestEstimates: this.scenario.fields.map(f => {
        if (!f.active) return null;
        const crop = this.crops[f.cropSlot];
        return { maturity: cropMaturity(f, crop), value: fieldHarvestValue(f, crop, this.cropMarketPrices[f.cropSlot]),
          workerFee: crop[57] === 1 ? f.bytes[58] | f.bytes[59] << 8 : 0 };
      }) };
    for (const listener of [...this.listeners]) listener();
    // Deliver only after the simulation phase and snapshot are complete. Copy per
    // observer so presentation cannot change another listener's request.
    const events = this.events; this.events = [];
    for (const event of events) for (const listener of [...this.eventListeners]) listener({ ...event });
  }
}

import { readFileSync } from 'node:fs';
import { readArchive } from '../../src/formats/archive';
import { readNewFarmRecordDefaults } from '../../src/formats/new-farm-records';
import { readNewFarmRuntimeDefaults } from '../../src/formats/new-farm-runtime';
import { readTrafficDefaults } from '../../src/formats/traffic';
import { readClimatePresets } from '../../src/formats/new-farm';
import { readCrop } from '../../src/formats/crop';
import { TownLayouts } from '../../src/formats/town';
import type { NewFarmOptions } from '../../src/simulation/new-farm-state';
import type { NewFarmAssets } from '../../src/simulation/create-farm';
const source = (name: string) => readFileSync(new URL(`../../../simfarm-dos/${name}`, import.meta.url));
export const newFarmExe = source('SIMFARM.EXE');
const archive = readArchive(source('MEGADATA.IDX'), source('MEGADATA.EEA'));
const asset = (name: string) => archive.find(e => e.name === name)!.bytes;
const records = readNewFarmRecordDefaults(newFarmExe);
export const newFarmAssets: NewFarmAssets = { records, runtime: readNewFarmRuntimeDefaults(newFarmExe), traffic: readTrafficDefaults(newFarmExe),
  climate: readClimatePresets(asset), crops: records.cropFiles.map(file => readCrop(file.slice(0, -4), source(`CROPS/${file.toUpperCase()}`))),
  townLayouts: new TownLayouts(asset('townly0.cmp')) };
export const newFarmOptions: NewFarmOptions = { climate: { precipitation: 2, temperature: 2, wind: 1 }, river: true, lake: false,
  date: { year: 1993, dayOfWeek: 1 }, seeds: { visual: 27, simulation: 9029, bounded: 51 } };

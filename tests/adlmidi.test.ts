import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {AdlMidiCore} from 'libadlmidi-js/light';
import {readArchive} from '../src/formats/archive';
import {decodeXmidi,encodeMidi} from '../src/formats/xmidi';

test('light WASM bank39 is AIL/SimFarm and renders all eight converted source MIDIs',async()=>{
  const synth=await AdlMidiCore.create();synth.init(44100);
  try{
    expect(synth.getEmbeddedBanks().find(b=>b.id===39)?.name).toMatch(/AIL.*SimFarm/i);
    expect(synth.setBank(39)).toBe(true);
    const source=(n:string)=>readFileSync(new URL('../../simfarm-dos/'+n,import.meta.url));
    const tracks=readArchive(source('MEGADATA.IDX'),source('MEGADATA.EEA')).filter(e=>e.name.endsWith('.xmi'));
    expect(tracks).toHaveLength(8);
    for(const track of tracks){
      const decoded=decodeXmidi(track.bytes);
      expect(synth.loadMidi(encodeMidi(decoded))).toBe(true);
      synth.setLoopEnabled(true);
      if(decoded.loop){
        expect(synth.getLoopStartTime()).toBeCloseTo(decoded.loop.startTick/120,4);
        expect(synth.getLoopEndTime()).toBeCloseTo(decoded.loop.endTick/120,4);
      }
      let peak=0;
      for(let i=0;i<44;i++)for(const sample of synth.play(1024))peak=Math.max(peak,Math.abs(sample));
      expect(peak).toBeGreaterThan(0.001);
    }
  }finally{synth.close();}
},10000);

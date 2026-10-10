import type {GameSnapshot} from './game';
import type {CropDefinition} from '../formats/crop';

export const EVALUATION_TOPICS=['Farm Growth','Town Growth','Productivity','Soil Quality','Environment Quality'] as const;
export const EVALUATION_PROBLEMS=['Weeds','Excess water','Chemical stress','Insufficient water','Insects','Fungus','Animal losses','Nutrient deficiency'] as const;
const signed=(word:number)=>word<<16>>16;
/** Low-word IMUL, CWD, IDIV from1ebf3/1ec23/1ec80/1ecac. Native
 * handles the sole signed-division overflow; see SF-167. */
export function evaluationRatio(n:number,d:number){return Math.trunc(signed(n*80)/(signed(d)||1));}
/** Read-only original Evaluation1ea84..1ee52 and suggestion scan1f17c.
 * Canonical annual words stay raw. Display reads never rewrite saved caches. */
export function evaluationWindowView(snapshot:GameSnapshot,crops:readonly CropDefinition[]){
  const {scenario,weather,finances,farmReport}=snapshot,w=finances.statistics.words,fields=farmReport.fields;
  const cap=(n:number)=>Math.min(80,n&65535);
  const quality=(count:number)=>{const n=evaluationRatio(count,fields.activeFields);return {raw:n,width:n===0?80:Math.max(0,Math.min(80,n)),color:n===0?8:3};};
  const growth=[evaluationRatio(w[0],w[11]),evaluationRatio(w[2],w[13]),(w[4]*12)&65535];
  const gauges=[...growth.map(raw=>({raw,width:cap(raw),color:8})),quality(fields.nutrientDeficientFields),quality(fields.chemicallyStressedFields)];
  // Source uses precipitationYear for BOTH tables, including temperatures.
  const start=weather.precipitationYear*48+scenario.farm.calendar.month*4+scenario.farm.calendar.week;
  let rain=0,heat=0,cold=0;
  for(let i=0;i<16;i++){
    const index=(start+i)%240,t=scenario.climate.temperature[index];
    rain=(rain+scenario.climate.precipitation[index])&65535;
    if(t>50)heat=(heat+t*7-350)&65535;
    if(t<45)cold=(cold+45-t)&65535;
  }
  rain>>>=1;
  const suggestions=scenario.cropFiles.flatMap((file,slot)=>{
    const crop=crops.find(c=>`${c.id}.crp`===file);
    if(!crop)throw new Error('Missing Evaluation crop');
    const word=(i:number)=>crop.rawDefinition[i]|crop.rawDefinition[i+1]<<8;
    return word(30)<=heat&&Math.trunc(word(28)/7)<=cold&&word(40)<=rain?[{slot,name:crop.name}]:[];
  });
  return {gauges,problems:fields.presence,suggestions,season:scenario.farm.calendar.season,climate:{rain,heat,cold}};
}
export type EvaluationView=ReturnType<typeof evaluationWindowView>;

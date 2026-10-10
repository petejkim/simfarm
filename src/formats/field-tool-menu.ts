/** Initialized DS545e/54b0; popup renderer37a20 uses17px row pitch,112px columns. */
export const FIELD_TOOL_MENUS={
  plant:{title:'Plant Field',x:48,y:64,width:224,height:160},
  spray:{title:'Spray Field',x:48,y:144,width:112,height:88},
} as const;
/** DS54a2→5494→5486→5478; the source item tile doubles as the treatment tool ID. */
export const SPRAY_TOOLS=[
  {kind:'fertilizer',label:'Fertilize',tile:915},{kind:'pesticide',label:'Pesticide',tile:914},
  {kind:'herbicide',label:'Herbicide',tile:913},{kind:'fungicide',label:'Fungicide',tile:912},
] as const;
export type FieldMapTool={kind:'plant';cropSlot:number}|{kind:typeof SPRAY_TOOLS[number]['kind']};

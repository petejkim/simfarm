/** Activation-triggering events per the HTML spec. A touch pointerdown is not one (its pointerup/touchend is), so
 * mobile browsers ignore audio started from pointerdown alone. Listeners should use the capture phase. */
export const ACTIVATION_EVENTS=['pointerdown','pointerup','touchend','click','keydown'] as const;

type AudioSessionNavigator=Navigator&{audioSession?:{type:string}};

/** Call synchronously inside an activation event. Declares playback audio, so iOS 17+ plays despite the ringer switch,
 * resumes the context, and starts a one-sample silent buffer, which older iOS releases need to unlock output. */
export function unlockAudioContext(context:AudioContext):void{
  const session=(navigator as AudioSessionNavigator).audioSession;
  if(session&&session.type!=='playback')try{session.type='playback';}catch{/* unsupported value */}
  if(context.state==='running')return;
  void context.resume().catch(()=>{});
  const source=context.createBufferSource();source.buffer=context.createBuffer(1,1,context.sampleRate);
  source.connect(context.destination);source.start(0);
}

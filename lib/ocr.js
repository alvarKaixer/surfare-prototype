export function needsOcrRetry(data){
 return (data.text.match(/[\p{L}\p{N}]/gu)||[]).length<8||data.confidence<75;
}

export function betterOcr(first,second){
 const length=data=>(data.text.match(/[\p{L}\p{N}]/gu)||[]).length;
 if(!length(second))return first;
 if(!length(first))return second;
 // Confidence is approximate: don't replace a complete reading with one confident word.
 if(second.confidence>first.confidence+4&&length(second)>=length(first)*.7)return second;
 if(length(second)>length(first)*1.5&&second.confidence>=first.confidence-3)return second;
 return first;
}

export async function recognizeImage(worker,source,{retry=true,prepareRetry=async(image)=>image,onRetry=()=>{},checkOrientation=false,prepareRotation=async(turn,full)=>source,onOrientation=(degrees)=>{}}={}){
 await worker.setParameters({tessedit_pageseg_mode:'3',thresholding_method:'0',user_defined_dpi:'300'});
 const {data:first}=await worker.recognize(source,{rotateAuto:true});
 let best=first,bestSource=source;
 // A landscape image may already be upright. Never rotate solely from its aspect ratio.
 // Use small probes only for weak readings; quarter turns need an expanded canvas,
 // because the engine's rotateRadians option can crop long lines at 90 degrees.
 if(checkOrientation&&needsOcrRetry(best)){
  onOrientation(0);
  let bestTurn=0;
  for(const turn of [1,3,2]){
   try{
    const probe=await prepareRotation(turn,false);
    const {data}=await worker.recognize(probe,{rotateAuto:true});
    if(data.confidence>=60&&betterOcr(best,data)===data){best=data;bestTurn=turn;}
    if(bestTurn&&best.confidence>=85&&!needsOcrRetry(best))break;
   }catch{ /* Keep the usable reading if a rotation probe fails. */ }
  }
  if(bestTurn){
   try{
    bestSource=await prepareRotation(bestTurn,true);
    const {data}=await worker.recognize(bestSource,{rotateAuto:true});
    best=betterOcr(best,data);onOrientation(bestTurn*90);
   }catch{ /* The smaller probe is still a valid OCR result. */ }
  }
 }
 if(!retry||!needsOcrRetry(best))return best;
 onRetry();
 // At most one extra pass. A failed fallback must not discard an existing reading.
 try{
  const alternate=await prepareRetry(bestSource);
  await worker.setParameters({tessedit_pageseg_mode:'11',thresholding_method:'2'});
  const {data:second}=await worker.recognize(alternate,{rotateAuto:true});
  return betterOcr(best,second);
 }catch{return best;}
}

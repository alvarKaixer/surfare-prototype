import {useRef,useState} from 'react';
import type {PointerEvent} from 'react';

type Crop={left:number;top:number;right:number;bottom:number};
const initial:Crop={left:.05,top:.05,right:.95,bottom:.95};
export default function ImageEditor({src,disabled,onCrop,onRotate,onRestore}:{src:string;disabled:boolean;onCrop:(crop:Crop)=>void;onRotate:()=>void;onRestore:()=>void}){
 const [cropping,setCropping]=useState(false),[crop,setCrop]=useState<Crop>(initial);
 const start=useRef<{x:number;y:number}|null>(null);
 function point(e:PointerEvent<HTMLDivElement>){const r=e.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))};}
 function move(e:PointerEvent<HTMLDivElement>){if(!start.current)return;const p=point(e),s=start.current;setCrop({left:Math.min(s.x,p.x),top:Math.min(s.y,p.y),right:Math.max(s.x,p.x),bottom:Math.max(s.y,p.y)});}
 return <div className="image-editor">
  <div className={'crop-image '+(cropping?'selecting':'')} onPointerDown={e=>{if(!cropping||disabled)return;e.preventDefault();start.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={move} onPointerUp={e=>{move(e);start.current=null;}} onPointerCancel={()=>{start.current=null;}}>
   <img src={src} alt="Selected image ready to check" draggable={false}/>
   {cropping&&<div className="crop-selection" style={{left:crop.left*100+'%',top:crop.top*100+'%',width:(crop.right-crop.left)*100+'%',height:(crop.bottom-crop.top)*100+'%'}}/>}
  </div>
  <div className="image-tools"><button disabled={disabled} onClick={()=>{setCrop(initial);setCropping(!cropping);}}>{cropping?'Cancel crop':'Crop to text'}</button><button disabled={disabled||cropping} onClick={onRotate}>Rotate 90°</button><button disabled={disabled||cropping} onClick={onRestore}>Restore original</button></div>
  {cropping&&<div className="crop-controls"><p>Drag a box around the message, leaving a small margin. You can also adjust the edges below.</p>{(['left','top','right','bottom'] as const).map(edge=><label key={edge}>{edge}<input type="range" aria-label={'Crop '+edge} min={edge==='right'?Math.round(crop.left*100)+2:edge==='bottom'?Math.round(crop.top*100)+2:0} max={edge==='left'?Math.round(crop.right*100)-2:edge==='top'?Math.round(crop.bottom*100)-2:100} value={Math.round(crop[edge]*100)} onChange={e=>setCrop({...crop,[edge]:Number(e.target.value)/100})}/></label>)}<button disabled={disabled||crop.right-crop.left<.02||crop.bottom-crop.top<.02} onClick={()=>{onCrop(crop);setCropping(false);}}>Use selected area</button></div>}
 </div>;
}

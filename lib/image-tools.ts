import {measurePixels, enhancePixels} from './image-pixels.js';

// Quality hints must not depend on an OCR engine download.
export async function imageQuality(canvas:HTMLCanvasElement,checkResolution=true){
 const sample=document.createElement('canvas');
 const scale=Math.min(1,900/Math.max(canvas.width,canvas.height));
 sample.width=Math.max(1,Math.round(canvas.width*scale));sample.height=Math.max(1,Math.round(canvas.height*scale));
 const ctx=sample.getContext('2d',{willReadFrequently:true})!;
 ctx.drawImage(canvas,0,0,sample.width,sample.height);
 const stats=measurePixels(ctx.getImageData(0,0,sample.width,sample.height).data,sample.width,sample.height);
 const warnings:string[]=[];
 if(stats.brightness<65)warnings.push('Use even lighting. For a dark screen, increase its brightness or upload a screenshot.');
 if(stats.sharpness<60)warnings.push('Small text may be blurred or too far away. Move closer and hold steady while the camera focuses.');
 if(checkResolution&&Math.max(canvas.width,canvas.height)<1200)warnings.push('This image has limited resolution. Fill the frame with the message or use an original screenshot.');
 return {...stats,warnings};
}

// Retain grayscale detail instead of permanently binarizing faint letters.
export async function preprocessCanvas(canvas:HTMLCanvasElement){
 const result=document.createElement('canvas');result.width=canvas.width;result.height=canvas.height;
 const ctx=result.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(canvas,0,0);
 const image=ctx.getImageData(0,0,result.width,result.height);
 enhancePixels(image.data);ctx.putImageData(image,0,0);return result;
}

export function bitmapCanvas(bitmap:ImageBitmap){
 if(bitmap.width*bitmap.height>40000000)throw Error('Use an image under 40 megapixels.');
 const canvas=document.createElement('canvas');
 // Keep more small-letter detail than the old 2400px limit while bounding memory.
 const scale=Math.min(1,3200/Math.max(bitmap.width,bitmap.height),Math.sqrt(8000000/(bitmap.width*bitmap.height)));
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return canvas;
}

export function ocrCanvas(canvas:HTMLCanvasElement){
 const result=document.createElement('canvas'),padding=20;
 // Upscaling cannot recover detail missing from a blurry photo.
 const scale=Math.min(2,Math.max(1,1500/Math.max(canvas.width,canvas.height)));
 result.width=Math.round(canvas.width*scale)+padding*2;result.height=Math.round(canvas.height*scale)+padding*2;
 const ctx=result.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,result.width,result.height);
 ctx.imageSmoothingQuality='high';ctx.drawImage(canvas,padding,padding,result.width-padding*2,result.height-padding*2);
 return result;
}

export function rotateCanvas(source:HTMLCanvasElement,turns:number,maxSide=Infinity){
 const turn=((turns%4)+4)%4,result=document.createElement('canvas');
 const scale=Math.min(1,maxSide/Math.max(source.width,source.height));
 const width=Math.max(1,Math.round(source.width*scale)),height=Math.max(1,Math.round(source.height*scale));
 // Swap dimensions for quarter turns so the ends of landscape text cannot be clipped.
 result.width=turn%2?height:width;result.height=turn%2?width:height;
 const ctx=result.getContext('2d')!;ctx.fillStyle='white';ctx.fillRect(0,0,result.width,result.height);
 ctx.translate(result.width/2,result.height/2);ctx.rotate(turn*Math.PI/2);
 ctx.imageSmoothingQuality='high';ctx.drawImage(source,-width/2,-height/2,width,height);
 return result;
}

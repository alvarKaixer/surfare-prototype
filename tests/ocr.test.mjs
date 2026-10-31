import test from 'node:test';
import assert from 'node:assert/strict';
import {measurePixels,enhancePixels} from '../lib/image-pixels.js';
import {recognizeImage,betterOcr} from '../lib/ocr.js';

const reading=(text,confidence)=>({text,confidence});
function fakeWorker(results){
 const calls=[],params=[];return {calls,params,async setParameters(p){params.push(p);},async recognize(source,options){calls.push({source,options});const next=results.shift();if(next instanceof Error)throw next;return {data:next};}};
}

test('clean text uses one pass and leaves source unchanged',async()=>{
 const result=reading('Your account will be blocked today. Send your OTP now.',92),worker=fakeWorker([result]);
 const data=await recognizeImage(worker,'original',{prepareRetry:()=>{throw Error('Unexpected retry');}});
 assert.equal(data,result);assert.equal(worker.calls.length,1);assert.equal(worker.calls[0].source,'original');assert.equal(worker.params[0].tessedit_pageseg_mode,'3');
});
test('weak reading gets one enhanced sparse-layout attempt',async()=>{
 const first=reading('Y0ur acc0u t OTP',42),second=reading('Your account will be blocked. Send your OTP.',89),worker=fakeWorker([first,second]);let retries=0;
 assert.equal(await recognizeImage(worker,'original',{prepareRetry:async()=>'enhanced',onRetry:()=>retries++}),second);
 assert.equal(retries,1);assert.equal(worker.calls.length,2);assert.equal(worker.calls[1].source,'enhanced');assert.equal(worker.params[1].tessedit_pageseg_mode,'11');
});
test('blank high-confidence result still retries',async()=>{
 const second=reading('Send your OTP now',85),worker=fakeWorker([reading('',99),second]);assert.equal(await recognizeImage(worker,'original'),second);
});
test('failed fallback preserves first reading; next scan resets thresholding',async()=>{
 const first=reading('Please verify your account',56),worker=fakeWorker([first,new Error('Fallback unavailable'),reading('A complete reading of the next message.',92)]);
 assert.equal(await recognizeImage(worker,'one'),first);await recognizeImage(worker,'two');assert.equal(worker.params[2].thresholding_method,'0');
});
test('user can disable automatic second pass',async()=>{
 const first=reading('OTP',25),worker=fakeWorker([first]);assert.equal(await recognizeImage(worker,'original',{retry:false}),first);assert.equal(worker.calls.length,1);
});
test('do not replace a full message with a confident single word or blank output',()=>{
 const first=reading('Your account is blocked. Send your OTP to unlock it.',58);
 assert.equal(betterOcr(first,reading('Your',99)),first);assert.equal(betterOcr(first,reading('',99)),first);
});
test('camera blur measurement distinguishes a uniform frame from sharp text edges',()=>{
 const flat=new Uint8ClampedArray(12*12*4).fill(255),edges=flat.slice();
 for(let y=0;y<12;y++)for(let x=0;x<12;x++)if(x%4<2){const i=(y*12+x)*4;edges[i]=edges[i+1]=edges[i+2]=0;}
 assert.equal(measurePixels(flat,12,12).sharpness,0);assert(measurePixels(edges,12,12).sharpness>1000);
});
test('enhancement retains grayscale detail and converts a dark screen to a light background',()=>{
 const pixels=new Uint8ClampedArray([20,20,20,255,20,20,20,255,80,80,80,255,150,150,150,255,230,230,230,255]);
 enhancePixels(pixels);assert(pixels[0]>pixels[16]);assert(pixels[8]>0&&pixels[8]<255);assert(pixels[12]>0&&pixels[12]<255);
});

test('upright landscape reading skips orientation probes',async()=>{
 const result=reading('Left edge: Your account will be blocked. Right edge: Send your OTP.',94),worker=fakeWorker([result]);
 assert.equal(await recognizeImage(worker,'wide-image',{checkOrientation:true,prepareRotation:async()=>{throw Error('Do not rotate an upright landscape');}}),result);
 assert.equal(worker.calls.length,1);
});
test('weak sideways text is probed and read again at full resolution even with enhancement off',async()=>{
 const wrong=reading('Unreadable sideways characters in this image',28),upright=reading('Your account will be blocked today. Send your OTP.',92),worker=fakeWorker([wrong,upright,upright]),rotations=[],stages=[];
 assert.equal(await recognizeImage(worker,'sideways',{retry:false,checkOrientation:true,prepareRotation:async(turn,full)=>{rotations.push({turn,full});return full?'full-upright':'small-upright';},onOrientation:degrees=>stages.push(degrees)}),upright);
 assert.deepEqual(rotations,[{turn:1,full:false},{turn:1,full:true}]);assert.deepEqual(stages,[0,90]);assert.equal(worker.calls.length,3);
});
test('upside-down recovery tries at most three rotations and does not rotate based on shape',async()=>{
 const wrong=reading('Words upside down and unreadable',28),right=reading('Your account will be blocked. Send your OTP.',94),worker=fakeWorker([wrong,wrong,wrong,right,right]),rotations=[];
 assert.equal(await recognizeImage(worker,'upside-down',{retry:false,checkOrientation:true,prepareRotation:async(turn,full)=>{rotations.push([turn,full]);return 'rotated';}}),right);
 assert.deepEqual(rotations,[[1,false],[3,false],[2,false],[2,true]]);
});
test('unhelpful or failed rotation probes preserve the original text',async()=>{
 const first=reading('Your account. Send your OTP.',62),worker=fakeWorker([first,reading('noise',20),new Error('Failed probe'),reading('',99)]);
 assert.equal(await recognizeImage(worker,'original',{retry:false,checkOrientation:true}),first);assert.equal(worker.calls.length,4);
});
test('contrast retry receives the corrected full-resolution image',async()=>{
 const wrong=reading('Words sideways unreadable',25),right=reading('Your account is blocked now.',70),enhanced=reading('Your account is blocked now.',92),worker=fakeWorker([wrong,right,wrong,wrong,right,enhanced]);let enhancedSource;
 assert.equal(await recognizeImage(worker,'sideways',{checkOrientation:true,prepareRotation:async(turn,full)=>full?'full-upright':'probe',prepareRetry:async source=>{enhancedSource=source;return 'enhanced';}}),enhanced);
 assert.equal(enhancedSource,'full-upright');assert.equal(worker.calls.length,6);
});

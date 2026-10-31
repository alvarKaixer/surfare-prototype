import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {mkdir,copyFile,readdir,unlink} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const tess=dirname(require.resolve('tesseract.js/package.json'));
const core=dirname(createRequire(join(tess,'package.json')).resolve('tesseract.js-core/package.json'));
await mkdir('public/ocr',{recursive:true});
await copyFile(join(tess,'dist/worker.min.js'),'public/ocr/worker.min.js');
const coreFiles=(await readdir(core)).filter(file=>/^tesseract-core(?:-simd)?-lstm\.wasm(?:\.js)?$/.test(file));
if(coreFiles.length!==4)throw Error('Expected both LSTM OCR cores and their WASM files.');
for(const file of coreFiles)await copyFile(join(core,file),'public/ocr/'+file);
// Quality-oriented LSTM model without unused legacy data (~3 MB vs 11 MB).
const eng=dirname(require.resolve('@tesseract.js-data/eng/package.json'));
await copyFile(join(eng,'4.0.0_best_int/eng.traineddata.gz'),'public/ocr/eng.traineddata.gz');
// Remove the obsolete generated asset so it isn't included in offline downloads.
await unlink('public/ocr/opencv.js').catch(error=>{if(error.code!=='ENOENT')throw error;});
console.log('Local OCR worker, SIMD/non-SIMD LSTM cores and language model ready');

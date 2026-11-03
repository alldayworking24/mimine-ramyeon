import {mkdir,copyFile} from 'node:fs/promises';
// Exact versions and integrity hashes live in package-lock.json. Copy the same
// browser engines used in the reviewed ZIP without committing generated binaries.
export async function prepareBrowserVendors(){
 const mappings={
  'auth/supabase.js':'@supabase/supabase-js/dist/umd/supabase.js',
  'auth/LICENSE':'@supabase/supabase-js/LICENSE',
  'barcode/zxing-browser.min.js':'@zxing/browser/umd/zxing-browser.min.js',
  'barcode/LICENSE':'@zxing/browser/LICENSE',
  'ocr/tesseract.min.js':'tesseract.js/dist/tesseract.min.js',
  'ocr/tesseract.min.js.LICENSE.txt':'tesseract.js/dist/tesseract.min.js.LICENSE.txt',
  'ocr/worker.min.js':'tesseract.js/dist/worker.min.js',
  'ocr/worker.min.js.LICENSE.txt':'tesseract.js/dist/worker.min.js.LICENSE.txt',
  'ocr/LICENSE.md':'tesseract.js/LICENSE.md',
  'ocr/core/LICENSE':'tesseract.js-core/LICENSE',
  'ocr/tessdata/kor.traineddata.gz':'@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz',
  'ocr/tessdata/eng.traineddata.gz':'@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'
 };
 for(const kind of ['lstm','simd-lstm','relaxedsimd-lstm'])mappings['ocr/core/tesseract-core-'+kind+'.wasm.js']='tesseract.js-core/tesseract-core-'+kind+'.wasm.js';
 for(const [target,source] of Object.entries(mappings)){
  await mkdir('flow/vendor/'+target.slice(0,target.lastIndexOf('/')),{recursive:true});
  await copyFile('node_modules/'+source,'flow/vendor/'+target);
 }
}

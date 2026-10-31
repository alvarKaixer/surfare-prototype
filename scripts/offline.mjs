import {generateSW} from 'workbox-build';
import {readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const revision=createHash('sha256').update((await readdir('dist/client',{recursive:true})).sort().join('\n')).digest('hex');
const result=await generateSW({globDirectory:'dist/client',globPatterns:['**/*.{js,css,wasm,gz,png,svg,json,webp,ttf,woff2,webmanifest}'],globIgnores:['sw.js','workbox-*.js','**/*.map'],maximumFileSizeToCacheInBytes:20000000,swDest:'dist/client/sw.js',skipWaiting:true,clientsClaim:true,cleanupOutdatedCaches:true,additionalManifestEntries:[{url:'/',revision}],navigateFallback:'/',navigateFallbackDenylist:[/^\/api\//,/^\/signin/,/^\/signout/,/^\/callback/],runtimeCaching:[],mode:'production'});console.log('Offline precache:',result.count,'files,',Math.round(result.size/1024/1024),'MB');for(const warning of result.warnings)console.warn(warning);

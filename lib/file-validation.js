export function inspectFileBytes(bytes,size) {
 if(size>10*1024*1024)throw Error('This file is larger than 10 MB. Choose a smaller image.');
 const b=bytes;
 if(b[0]===0x89&&b[1]===0x50&&b[2]===0x4e&&b[3]===0x47&&b[4]===13&&b[5]===10&&b[6]===26&&b[7]===10)return 'image/png';
 if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';
 throw Error('This file is not a supported image. Choose a real PNG, JPEG or WebP file; renaming a file does not convert it.');
}

const lzham = require('bindings')('lzham')

// let buf = Buffer.from('test');
// // console.log(buf)
// let ret = lzham.decompress(buf);
// console.log(ret);

// console.log(lzham.testBuf());
// console.log(lzham.test());

export default function(buf:Buffer) {
    return lzham.decompress(buf);
}
# TFVPKTool
A typescript library for reading Respawn VPK archives.

## Features

### VPK reading
The VPK class allows for reading of `_dir.vpk` files, parsing their trees and reading files from archive VPKs referenced within them.

The primary use of the VPK class is reading directory trees.

**Examples:**
```ts
// ts
import { VPK } from "./src";

let vpk: VPK = new VPK(vpkDirPath);
vpk.readTree();
```
```js
// node.js
const { VPK } = require("./dist");

let vpk = new VPK(vpkDirPath);
vpk.readTree();
```
### VPK file reading
The VPK.readFile method reads individual files to memory and is capable of decompressing compressed files (using a native LZHAM addon), comparing CRC32 values on read files (except audio), and adding correct headers to `.wav` files (by reading `.cam` files) so that they can be played back.

*For multi-threaded file reading to disk use VPKCopy.*

**Examples:**
```ts
// ts
import { VPK } from "./src";

// vpk: VPK = new VPK(vpkDirPath)
await vpk.readFile(searchPath);
```
```js
// node.js
const { VPK } = require("./dist");

// vpk = new VPK(vpkDirPath)
await vpk.readFile(searchPath);
```

### VPK file copying
The VPKCopy class is used for multi-threaded copying of files from the VPK to the file system.

The method VPKCopy.copy reads all file paths in the array passed and writes them to outPath/filePath.

VPKCopy acts as an easy wrapper for loading and reading multiple files using the VPK class.

**Examples:**
```ts
// ts
import { VPKCopy, VPKCopyProgress } from "./src";

// vpkPath: string, threads: number
let copier: VPKCopy = new VPKCopy(vpkPath, threads);

copier.on("progress", (data: VPKCopyProgress) => {
    console.log(`${data.current}/${data.total}\t | Worker ${("0"+data.workerIdx).slice(-2)} |\tCopying "${data.file}"`)
});

// files: string[], outPath: string
await copier.copy(files, outPath);

copier.close();

console.log("Copying complete")
```
```js
// node.js
const { VPKCopy } = require("./dist");

let copier = new VPKCopy(vpkPath, threads);

copier.on("progress", (data) => {
    console.log(`${data.current}/${data.total}\t | Worker ${("0"+data.workerIdx).slice(-2)} |\tCopying "${data.file}"`)
});

await copier.copy(files, outPath);

copier.close();

console.log("Copying complete")
```

## Compiling TFVPKTool
Run the following:
```console
npm install
npm run compile
```
You should have a compiled build in `./dist`

If just running with ts-node (`npm start`) compiling is unnecessary but `npm install` is.

## Importing TFVPKTool
```js
// commonjs
const { VPK, VPKCopy } = require("./dist");

// es6
import { VPK, VPKCopy } from "./dist"
```
*Note that VPK and VPKCopy can also be individually imported from `./dist/vpk` and `./dist/reader` respectively.*

----

### Notes
The initial release was made in 2 days, there may be bugs but I tried my best to iron them out.

Thanks to [p0358](https://github.com/p0358/) for help with reversing some of the structs. No thanks to [cra0kalo](https://github.com/cra0kalo/) for keeping VPKTool closed-source.

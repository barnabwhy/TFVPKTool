import { Acache } from "./acache";
import { WriteBuffer } from "./buffer";
import { findLastIndex, stripPakLang } from "./common";
import { crc32 } from "./crc";
import { EPackedLoadFlags, EPackedTextureFlags, VPKFilePartEntry } from "./filepart";
import { HEADER_196610_LENGTH } from "./header"
import { VPKDirectoryEntry } from "./tree";
import { VPK } from "./vpk";

const fs = require('fs');
const lzham = require('./build/Release/lzham.node');

const MAX_UNPACKED_PART_LENGTH = 1048576;
const FILEPART_ENTRY_BYTES = 32;
const CAM_ENTRY_BYTES = 32;

const COMPRESSION_THRESHOLD = 4096;
const COMPRESSION_EXCLUDED_TYPES = ["wav", "vtf"]

interface PartialCAMEntry {
    magic: number;	// should be 00 1A DE C4
    originalSize: number;
    compressedSize: number;
    sampleRate: number;
    channels: number;
    sampleDepth: number;
    sampleCount: number;
    headerSize: number;
    path: string
}

function constructCamData(file: Buffer, path: string): PartialCAMEntry {
    let dataLength = file.readUInt32LE(40);
    let blockAlign = file.readUInt16LE(32);
    let sampleCount = dataLength / blockAlign;

    let camData = {
        magic: 3302889984,
        originalSize: file.length,
        compressedSize: file.length,
        sampleRate: file.readUInt32LE(24),
        channels: file.readUInt16LE(22),
        sampleDepth: file.readUInt16LE(34),
        sampleCount,
        headerSize: 44,
        path
    } as PartialCAMEntry;

    return camData;
}

function stripWavHeaders(file: Buffer): Buffer {
    if(file.readUInt32LE(0) != 0xCBCBCBCB) {
        let headerBuffer = Buffer.alloc(44).fill(0xCB);
        let checksum1 = 0;
        let checksum2 = 0;

        headerBuffer.writeUInt32LE(checksum1, 4);
        headerBuffer.writeUInt32LE(checksum2, 8);

        headerBuffer.copy(file);
    }
    return file;
}

class VPKFilePart {
    archiveIndex: number | undefined;

    loadFlags: EPackedLoadFlags = EPackedLoadFlags.LOAD_NONE;
    textureFlags: EPackedTextureFlags = EPackedTextureFlags.TEXTURE_NONE; /// only vtfs
    entryLength: number = NaN;
    entryLengthUncompressed: number = NaN;
    entryOffset: number = NaN;

    isCompressed: boolean = false;

    buffer: Buffer | undefined;

    constructor(buf: Buffer, loadFlags: EPackedLoadFlags, textureFlags: EPackedTextureFlags, entryLength: number, entryLengthUncompressed: number) {
        this.buffer = buf;
        this.loadFlags = loadFlags;
        this.textureFlags = textureFlags;
        this.entryLength = entryLength;
        this.entryLengthUncompressed = entryLengthUncompressed;

        this.isCompressed = entryLength != entryLengthUncompressed;
    }
}

class VPKFilePartify {
    archiveIndex: number | undefined;

    loadFlags: EPackedLoadFlags = EPackedLoadFlags.LOAD_NONE;
    textureFlags: EPackedTextureFlags = EPackedTextureFlags.TEXTURE_NONE; /// only vtfs
    entryLength: number = NaN;
    entryLengthUncompressed: number = NaN;
    entryOffset: number = NaN;

    isCompressed: boolean = false;

    buffer: Buffer | undefined;

    constructor(filePart: VPKFilePartEntry) {
        this.archiveIndex = filePart.archiveIndex;

        this.loadFlags = filePart.loadFlags;
        this.textureFlags = filePart.textureFlags;
        this.entryLength = filePart.entryLength;
        this.entryLengthUncompressed = filePart.entryLengthUncompressed;
        this.entryOffset = filePart.entryOffset;

        this.isCompressed = filePart.isCompressed;
    }
}

class VPKDirEntry {
    fileParts: VPKFilePart[];
    crc: number = NaN;
    preloadBytes: number = 0;
    preload: Buffer | undefined = undefined;

    length: number;

    path: string;
    extension: string;
    fileName: string;
    directory: string;

    constructor(path: string, fileParts: VPKFilePart[], preload: Buffer | undefined = undefined) {
        this.path = path;
        this.extension = (path.split(".").pop() || "") + "\0";
        this.fileName = (path.split("/").pop() || "").split(".").slice(0, -1).join(".") + "\0";
        this.directory = path.split("/").slice(0, -1).join("/") + "\0";
        if(this.directory == "\0")
            this.directory = "\x20\0" // very important

        this.fileParts = fileParts;
        this.length = fileParts.reduce((l, p) => l + p.entryLength, 0);

        if(preload) {
            this.preloadBytes = preload.length;
            this.preload = preload;

            this.length += preload.length;
        }
    }
}

class VPKDirEntryify {
    fileParts: VPKFilePart[];
    crc: number;
    preloadBytes: number = 0;
    preload: Buffer | undefined = undefined;

    length: number;

    path: string;
    extension: string;
    fileName: string;
    directory: string;

    constructor(path: string, entry: VPKDirectoryEntry) {
        this.path = path;
        this.extension = (path.split(".").pop() || "") + "\0";
        this.fileName = (path.split("/").pop() || "").split(".").slice(0, -1).join(".") + "\0";
        this.directory = path.split("/").slice(0, -1).join("/") + "\0";
        if(this.directory == "\0")
            this.directory = "\x20\0"

        this.fileParts = entry.fileParts.map(p => (new VPKFilePartify(p) as VPKFilePart));
        this.length = this.fileParts.reduce((l, p) => l + p.entryLength, 0) + entry.preloadBytes;

        this.preloadBytes = entry.preloadBytes;
        this.crc = entry.crc;
    }
}

export class VPacker {
    entries: VPKDirEntry[];

    camEntries: PartialCAMEntry[];

    archiveLength: number;
    archiveIndex: number = 999;

    writtenParts: VPKFilePart[];

    constructor() {
        this.archiveLength = 0;
        this.entries = [];
        this.camEntries = [];
        this.writtenParts = [];
    }

    async remove(path: string) {
        let idx  = this.entries.findIndex(e => e.path == path);
        if(idx != -1) {
            this.entries = this.entries.splice(idx, 1);
        }
    }

    async addFile(filePath: string, path: string) {
        let fileBuf = await fs.promises.readFile(filePath);
        return this.addBuffer(fileBuf, path);
    }
    async addFileMultiple(filePath: string, paths: string[]) {
        return Promise.all(paths.map(async path => {
            let fileBuf = await fs.promises.readFile(filePath);
            return this.addBuffer(fileBuf, path)
        }));
    }

    async addBuffer(file: Buffer, path: string) {
        let fileParts: VPKFilePart[] = [];
        let filePartOffset = 0;

        let extension = path.split(".").pop() || "";

        let crc = crc32(file);

        if(extension == "wav") {
            this.camEntries.push(constructCamData(file, path));
            file = stripWavHeaders(file);
        }

        while(filePartOffset < file.length) {
            let length = Math.min(file.length - filePartOffset, MAX_UNPACKED_PART_LENGTH);

            let partBuf = file.subarray(filePartOffset, filePartOffset+length);

            if(length >= COMPRESSION_THRESHOLD && COMPRESSION_EXCLUDED_TYPES.indexOf(extension) == -1) {
                partBuf = lzham.compress(partBuf);
            }

            let loadFlags = EPackedLoadFlags.LOAD_VISIBLE;
            if(extension == "wav")
                loadFlags = EPackedLoadFlags.LOAD_VISIBLE | EPackedLoadFlags.LOAD_CACHE;
            if(extension == "acache")
                loadFlags = EPackedLoadFlags.LOAD_VISIBLE | EPackedLoadFlags.LOAD_CACHE | EPackedLoadFlags.LOAD_ACACHE_UNK0; //1281

            let filePart = new VPKFilePart(partBuf, loadFlags, EPackedTextureFlags.TEXTURE_NONE, partBuf.length, length);
            fileParts.push(filePart);

            filePartOffset += length;
        }
        let entry = new VPKDirEntry(path, fileParts);
        entry.crc = crc;
        this.entries.push(entry);
        this.archiveLength += entry.length;
    }

    createDir(): Buffer {
        let treeLength = this.entries.reduce((l, e) => l + (e.extension.length + e.directory.length + e.fileName.length + e.preloadBytes + e.fileParts.length * FILEPART_ENTRY_BYTES + 12), 0);
        let w = new WriteBuffer(treeLength);

        let lastExtension = "";
        let lastDirectory = "";

        for(const entry of this.entries) {
            if(entry.extension != lastExtension && lastExtension != "") {
                w.writeUInt16(0)
            } else if (entry.directory != lastDirectory && lastDirectory != "") {
                w.writeUInt8(0);
            }
            if(entry.extension != lastExtension) {
                w.writeBuffer(Buffer.from(entry.extension)); // extension
                lastExtension = entry.extension;
            }
            if(entry.directory != lastDirectory) {
                w.writeBuffer(Buffer.from(entry.directory)); // directory
                lastDirectory = entry.directory;
            }

            w.writeBuffer(Buffer.from(entry.fileName)); // fileName

            w.writeUInt32(entry.crc); // crc
            w.writeUInt16(entry.preloadBytes) // preloadBytes

            for(const filePart of entry.fileParts) {
                w.writeUInt16(filePart.archiveIndex == undefined ? this.archiveIndex : filePart.archiveIndex);

                w.writeUInt16(filePart.loadFlags);
                w.writeUInt32(filePart.textureFlags);
                w.writeUInt64(filePart.entryOffset);
                w.writeUInt64(filePart.entryLength);
                w.writeUInt64(filePart.entryLengthUncompressed);
            }

            w.writeUInt16(0xFFFF);

            if(entry.preload)
                w.writeBuffer(entry.preload)
        }
        w.writeUInt24(0x000000);

        return w.getBuffer().subarray(0, w.tell());
    }

    createHeader(treeLength: number): Buffer {
        let w = new WriteBuffer(HEADER_196610_LENGTH)
        w.writeUInt32(0x55aa1234); // signature
        w.writeUInt32(196610); // version
        w.writeUInt32(treeLength); // treeLength
        w.writeUInt32(0); // unknown1

        return w.getBuffer();
    }

    createArchive(): Buffer {
        let w = new WriteBuffer(this.archiveLength);

        for(const entry of this.entries) {
            for(const filePart of entry.fileParts) {
                if(!filePart.archiveIndex) {
                    let wP = this.writtenParts.find(wP => (filePart.buffer || Buffer.alloc(0)).equals((wP.buffer || Buffer.alloc(0))));
                    if(wP) {
                        filePart.entryOffset = wP.entryOffset;
                        filePart.archiveIndex = wP.archiveIndex;
                    } else {
                        filePart.entryOffset = w.tell();
                        filePart.archiveIndex = this.archiveIndex
                        w.writeBuffer(filePart.buffer || Buffer.alloc(0));

                        this.writtenParts.push(filePart);
                    }
                }
            }
        }

        return w.getBuffer().subarray(0, this.writtenParts.reduce((l, wP) => wP.buffer ? l + wP.buffer.length : l, 0));
    }

    createCam(): Buffer {
        let w = new WriteBuffer(this.camEntries.length * CAM_ENTRY_BYTES);
        for(const entry of this.entries) {
            if(entry.extension == "wav\0") {
                let camEntry = this.camEntries.find(c => c.path == entry.path);
                if(camEntry) {
                    w.writeUInt32(camEntry.magic);
                    w.writeUInt32(camEntry.originalSize);
                    w.writeUInt32(camEntry.compressedSize);
                    w.writeUInt24(camEntry.sampleRate);
                    w.writeUInt8(camEntry.channels);
                    w.writeUInt32(camEntry.sampleCount);
                    w.writeUInt32(camEntry.headerSize);
                    w.writeUInt64(entry.fileParts[0].entryOffset);
                }
            }
        }
        return w.getBuffer();
    }

    writeVPK(vpkPath: string) {
        this.archiveIndex = 999;
        this.entries = this.entries.sort((a, b) => (a.extension + a.directory).localeCompare(b.extension + b.directory))

        const archiveBuffer = this.createArchive();
        const camBuffer = this.createCam();

        const dirBuffer = this.createDir();
        const headerBuffer = this.createHeader(dirBuffer.length);

        fs.writeFileSync(vpkPath, Buffer.concat([headerBuffer, dirBuffer]));
        let archivePath = stripPakLang(vpkPath).replace("_dir", "_"+("000"+this.archiveIndex).slice(-3));
        fs.writeFileSync(archivePath, archiveBuffer);
        if(this.camEntries.length > 0) {
            let camPath = stripPakLang(vpkPath).replace("_dir", "_"+("000"+this.archiveIndex).slice(-3)) + ".cam";
            fs.writeFileSync(camPath, camBuffer);
        }
    }
}

export class VPatcher extends VPacker {
    vpk: VPK;
    acache: Acache | undefined;

    newEntries: VPKDirEntry[];
    oldEntries: VPKDirEntry[];

    constructor(vpkPath: string) {
        super();

        this.newEntries = [];
        this.oldEntries = [];
        this.vpk = new VPK(vpkPath);
        this.vpk.readTree();

        if(this.vpk.files.includes("sound/wav.acache")) {
            this.readAcache();
        }
    }

    async readAcache() {
        let buf = await this.vpk.readFile("sound/wav.acache");
        if(buf)
            this.acache = new Acache(buf);
    }

    async remove(path: string) {
        let idx  = this.entries.findIndex(e => e.path == path);
        if(idx != -1) {
            this.entries = this.entries.splice(idx, 1);
        }

        if(this.vpk.tree.files[path]) {
            delete this.vpk.tree.files[path];
        }
    }

    async writeVPK(vpkPath: string) {
        this.archiveIndex = 999;

        this.newEntries = this.entries.sort((a, b) => (b.extension + b.directory).localeCompare(a.extension + a.directory));
        this.oldEntries = Object.entries(this.vpk.tree.files).map(e=> new VPKDirEntryify(e[0], e[1]));

        for(const entry of this.newEntries) {
            let oldEntryIdx = this.oldEntries.findIndex(e => e.path == entry.path);
            if(oldEntryIdx != -1) {
                if(entry.extension == "wav\0" && this.acache) {
                    let acacheEntryIdx = this.acache?.entries.findIndex(a => a.path == entry.path);
                    if(acacheEntryIdx != -1) {
                        let acacheEntry = this.acache?.entries[acacheEntryIdx];
                        let camEntry = this.camEntries.find(c => c.path == entry.path);
                        if(camEntry) {
                            acacheEntry.blockCount = camEntry.channels * camEntry.sampleCount;
                            acacheEntry.channels = camEntry.channels;
                            acacheEntry.sampleDepth = camEntry.sampleDepth;
                        }
                        this.acache.entries[acacheEntryIdx] = acacheEntry;
                    }
                }
            }
        }

        if(this.acache) {
            await this.addBuffer(await this.acache.toBuffer(), "sound/wav.acache")
        }

        this.newEntries = this.entries.sort((a, b) => (b.extension + b.directory).localeCompare(a.extension + a.directory));

        const archiveBuffer = this.createArchive();
        const camBuffer = this.createCam();

        this.entries = this.oldEntries;

        for(const entry of this.newEntries) {
            let oldEntryIdx = this.entries.findIndex(e => e.path == entry.path);
            if(oldEntryIdx != -1) {
                this.entries[oldEntryIdx] = entry;
            } else {
                let idx = findLastIndex(this.entries, (e, i, a) => e.extension == a[i].extension && e.directory == a[i].directory);
                if(idx == -1) idx = findLastIndex(this.entries, (e, i, a) => e.extension == a[i].extension);
                this.entries.splice(idx, 0, entry);
            }
        }

        const dirBuffer = this.createDir();
        const headerBuffer = this.createHeader(dirBuffer.length);

        fs.writeFileSync(vpkPath, Buffer.concat([headerBuffer, dirBuffer]));
        let archivePath = stripPakLang(vpkPath).replace("_dir", "_"+("000"+this.archiveIndex).slice(-3));
        fs.writeFileSync(archivePath, archiveBuffer);
        if(this.camEntries.length > 0) {
            let camPath = stripPakLang(vpkPath).replace("_dir", "_"+("000"+this.archiveIndex).slice(-3)) + ".cam";
            fs.writeFileSync(camPath, camBuffer);
        }
    }
}
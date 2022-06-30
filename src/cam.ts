import ReadBuffer from "./buffer";
const fs = require('fs');

class CAMEntry {
    magic: number = NaN;	// should be 00 1A DE C4
    originalSize: number = NaN;
    compressedSize: number = NaN;
    bitrate: number = NaN;
    channels: number = NaN;
    sampleCount: number = NaN;
    headerSize: number = NaN;
    vpkContentOffset: number = NaN;

    constructor(r: ReadBuffer) {
        this.magic = r.readUInt32();
        this.originalSize = r.readUInt32();
        this.compressedSize = r.readUInt32();
        this.bitrate = r.readUInt24();
        this.channels = r.readUInt8();
        this.sampleCount = r.readUInt32();
        this.headerSize = r.readUInt32();
        this.vpkContentOffset = r.readUInt64();
    }
}

export default class CAM {
    entries: CAMEntry[] = [];
    hasRead: boolean = false;

    camPath: string;
    constructor(vpkPath: string) {
        this.camPath = vpkPath+'.cam';
    }

    read() {
        const stat = fs.statSync(this.camPath);
        let r: ReadBuffer = new ReadBuffer(stat.size, this.camPath);

        while (true) {
            if(r.tell() == stat.size)
                break;
            
            let entry = new CAMEntry(r);

            if(entry.magic == 3302889984)
                this.entries.push(entry);
        }
    }
}
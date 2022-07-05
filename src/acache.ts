import { ReadBuffer, WriteBuffer } from "./buffer"

class AcacheHeader
{
    version: number = NaN; // should be 3
    unknown1: number = NaN; // ?
    unknown2: number = NaN; // ?

    constructor(r: ReadBuffer) {
        this.version = r.readUInt32();
        this.unknown1 = r.readUInt32();
        this.unknown2 = r.readUInt32();
    }
}

const MAX_PATH_LENGTH = 260;

const ACACHE_ENTRY_BYTES = 296;
	
class AcacheEntry
{
    offset: number;
    path: string; // max length: 260
    blockCount: number; // sample count * channels
    unknown1: number; // what the actual fuck is this
    unknown2: number; // what the actual fuck is this
    channels: number;
    unknown3: number; // always 0 or 1?
    unknown4: number; // always 0?
    headerSize: number;
    sampleDepth: number;
    unknown5: number; // always 0?
    unknown6: number; // always 16?
    unknown7: number; // multiple of 8? increments by 8 every time, ocassionally skips
    maybeTerminator: number; // always 01 00 00 00? terminator?

    valid: boolean;

    constructor(r: ReadBuffer) {
        this.offset = r.tell();
        this.path = r.readStringLen(MAX_PATH_LENGTH);
        this.valid = this.path.length > 0;
        this.blockCount = r.readUInt32();
        this.unknown1 = r.readUInt16();
        this.unknown2 = r.readUInt16();
        this.channels = r.readUInt32();
        this.unknown3 = r.readUInt32();
        this.unknown4 = r.readUInt32();
        this.headerSize = r.readUInt8();
        this.sampleDepth = r.readUInt24();
        this.unknown5 = r.readUInt32();
        this.unknown6 = r.readUInt8();
        this.unknown7 = r.readUInt24();
        this.maybeTerminator = r.readUInt32();
    }
}

export class Acache {
    buffer: Buffer;
    header: AcacheHeader;
    entries: AcacheEntry[] = [];

    constructor(buf: Buffer) {
        this.buffer = buf;
        let r = new ReadBuffer(buf);

        this.header = new AcacheHeader(r);

        let entry = new AcacheEntry(r);
        while(entry.valid) {
            this.entries.push(entry);
            entry = new AcacheEntry(r);
        }
    }

    toBuffer(): Buffer {
        let buf = this.buffer;
        for(let entry of this.entries) {
            let w = new WriteBuffer(ACACHE_ENTRY_BYTES);

            let pathBuf = Buffer.alloc(MAX_PATH_LENGTH);
            Buffer.from(entry.path).copy(pathBuf)
            w.writeBuffer(pathBuf);
            w.writeUInt32(entry.blockCount);
            w.writeUInt16(entry.unknown1);
            w.writeUInt16(entry.unknown2);
            w.writeUInt32(entry.channels);
            w.writeUInt32(entry.unknown3);
            w.writeUInt32(entry.unknown4);
            w.writeUInt8(entry.headerSize);
            w.writeUInt24(entry.sampleDepth);
            w.writeUInt32(entry.unknown5);
            w.writeUInt8(entry.unknown6);
            w.writeUInt24(entry.unknown7);
            w.writeUInt32(entry.maybeTerminator);

            w.getBuffer().copy(buf, entry.offset);
        }

        return buf;
    }
}
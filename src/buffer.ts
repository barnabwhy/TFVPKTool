const fs = require('fs');

export class ReadBuffer {
    private offset: number = 0;

    private buffer: Buffer;
    
    constructor(lengthOrBuffer: number | Buffer, inputPath: string | undefined = undefined) {
        if(typeof lengthOrBuffer == 'number') {
            this.buffer = Buffer.alloc(lengthOrBuffer);
        } else {
            this.buffer = Buffer.alloc(lengthOrBuffer.byteLength);
            lengthOrBuffer.copy(this.buffer);
        }
        if(inputPath) {
            let file = fs.openSync(inputPath, 'r');
            fs.readSync(file, this.buffer, 0, this.buffer.length, 0);
            fs.closeSync(file);
        }
        this.offset = 0;
    }

    readBytes(lengthBytes: number): Buffer {
        let ret: Buffer = this.buffer.subarray(this.offset, this.offset + lengthBytes);
        this.offset += lengthBytes;
        return ret;
    }
    readInt8(): number {
        let ret: number = this.buffer.readInt8(this.offset)
        this.offset += 1;
        return ret;
    }
    readUInt8(): number {
        let ret: number = this.buffer.readUInt8(this.offset)
        this.offset += 1;
        return ret;
    }
    readInt16(): number {
        let ret: number = this.buffer.readInt16LE(this.offset)
        this.offset += 2;
        return ret;
    }
    readUInt16(): number {
        let ret: number = this.buffer.readUInt16LE(this.offset)
        this.offset += 2;
        return ret;
    }
    readInt24(): number {
        let ret: number = this.buffer.readIntLE(this.offset, 3)
        this.offset += 3;
        return ret;
    }
    readUInt24(): number {
        let ret: number = this.buffer.readUIntLE(this.offset, 3)
        this.offset += 3;
        return ret;
    }
    readInt32(): number {
        let ret: number = this.buffer.readUInt32LE(this.offset)
        this.offset += 4;
        return ret;
    }
    readUInt32(): number {
        let ret: number = this.buffer.readUInt32LE(this.offset)
        this.offset += 4;
        return ret;
    }
    readUInt32BE(): number {
        let ret: number = this.buffer.readUInt32BE(this.offset)
        this.offset += 4;
        return ret;
    }
    readUInt64(): number {
        const hi = this.buffer.readUInt32LE(this.offset+4)
        const lo = this.buffer.readUInt32LE(this.offset)
        this.offset += 8;
        return lo + 2**32 * hi;
    }
    readString(): string {
        let termninatorIndex: number = this.buffer.indexOf('\0', this.offset)
        let ret: string = this.buffer.subarray(this.offset, termninatorIndex).toString()
        this.offset = termninatorIndex + 1;
        return ret;
    }
    readStringLen(length: number): string {
        let termninatorIndex: number = Math.min(this.buffer.indexOf('\0', this.offset), this.offset+length)
        let ret: string = this.buffer.subarray(this.offset, termninatorIndex).toString()
        this.offset += length;
        return ret;
    }

    skip(bytes: number) {
        this.offset += bytes;
    }
    setOffset(bytes: number) {
        this.offset = bytes;
    }
    tell(): number {
        return this.offset;
    }
}

export class WriteBuffer {
    private offset: number = 0;

    private buffer: Buffer;
    
    constructor(lengthOrBuffer: number | Buffer) {
        if(typeof lengthOrBuffer == 'number') {
            this.buffer = Buffer.alloc(lengthOrBuffer);
        } else {
            this.buffer = Buffer.alloc(lengthOrBuffer.byteLength);
            lengthOrBuffer.copy(this.buffer);
        }
        this.offset = 0;
    }

    writeInt8(n: number) {
        this.buffer.writeInt8(n, this.offset)
        this.offset += 1;
    }
    writeUInt8(n: number) {
        this.buffer.writeUInt8(n, this.offset)
        this.offset += 1;
    }
    writeInt16(n: number) {
        this.buffer.writeInt16LE(n, this.offset)
        this.offset += 2;
    }
    writeUInt16(n: number) {
        this.buffer.writeUInt16LE(n, this.offset)
        this.offset += 2;
    }
    writeInt24(n: number) {
        this.buffer.writeIntLE(n, this.offset, 3)
        this.offset += 3;
    }
    writeUInt24(n: number) {
        this.buffer.writeUIntLE(n, this.offset, 3)
        this.offset += 3;
    }
    writeInt32(n: number) {
        this.buffer.writeInt32LE(n, this.offset)
        this.offset += 4;
    }
    writeUInt32(n: number) {
        this.buffer.writeUInt32LE(n, this.offset)
        this.offset += 4;
    }
    writeUInt64(n: number) {
        let hi = Math.floor(n/2**32);
        let lo = (n & 0xffffffff) >>> 0;
        this.buffer.writeUInt32LE(hi, this.offset+4)
        this.buffer.writeUInt32LE(lo, this.offset)
        this.offset += 8;
    }
    writeBuffer(buf: Buffer) {
        buf.copy(this.buffer, this.offset);
        this.offset += buf.length;
    }

    skip(bytes: number) {
        this.offset += bytes;
    }
    setOffset(bytes: number) {
        this.offset = bytes;
    }
    tell(): number {
        return this.offset;
    }

    get length() {
        return this.buffer.length;
    }

    getBuffer() {
        let buf = Buffer.alloc(this.buffer.length);
        this.buffer.copy(buf);
        return buf;
    }
}
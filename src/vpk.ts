import { crc32 } from "./crc";
import { CAM } from "./cam";
import { VPKHeader } from "./header";
import { VPKTree } from "./tree";
import { stripPakLang } from "./common";
import { PassThrough, Readable } from "stream";

const fs = require('fs');
const lzham = require('./build/Release/lzham.node')
import ffmpeg from '@ffmpeg-installer/ffmpeg';
import FFmpeg from 'fluent-ffmpeg';
FFmpeg.setFfmpegPath(ffmpeg.path);


interface VPKCamList {
    [key: string]: CAM
}
interface VPKReadHandleList {
    [key: string]: any
}

export class VPK {
    directoryPath: string;

    errors: string[] = [];
    header: VPKHeader;
    tree: VPKTree;

    cams: VPKCamList = {};
    readHandles: VPKReadHandleList = {};

    constructor(path: string) {
        this.directoryPath = path;

        this.tree = new VPKTree();
        this.header = new VPKHeader();

        if(this.isValid()) {
            this.header.read(path);
        }
    }

    isValid(): boolean {
        let valid = true;
        if(this.directoryPath.split('_').pop() != 'dir.vpk') {
            this.errors.push('Not a "_dir.vpk" file')
            valid = false;
        }
        if(!fs.existsSync(this.directoryPath)) {
            this.errors.push("File doesn't exist");
            valid = false;
        }

        return valid;
    }
    readTree() {
        if(this.tree instanceof VPKTree)
            this.tree.read(this.directoryPath);
    }

    get files() {
        return Object.keys(this.tree instanceof VPKTree ? this.tree.files : []);
    }

    close() {
        Promise.all(Object.values(this.readHandles).map(h => h.close()))
        .then(() => { this.readHandles = {} })
    }

    async readFile(path: string, patchWav: boolean = true, convertWavToOgg: boolean = false): Promise<Buffer | null> {
        if(!this.isValid())
            throw new Error('VPK isn\'t valid')

        if(!this.header.isValid())
            throw new Error('VPK header is not valid')

        if(!(this.tree.hasRead))
            throw new Error('VPK tree has not yet been read')

        let entry = this.tree.files[path];

        if (!entry) {
            return null;
        }

        let entryLength = 0;
        for(const part of entry.fileParts) {
            entryLength += part.entryLengthUncompressed;
        }

        let file = Buffer.alloc(entry.preloadBytes + entryLength);

        let currentLength = 0;
        if (entry.preloadBytes > 0) {
            if(!this.readHandles[this.directoryPath])
                this.readHandles[this.directoryPath] = await fs.promises.open(this.directoryPath, 'r');

            await this.readHandles[this.directoryPath].read(file, 0, entry.preloadBytes, entry.preloadOffset);
            currentLength += entry.preloadBytes
        }

        let camEntry;

        if (entryLength > 0) {
            for(let i = 0; i < entry.fileParts.length; i++) {
                const part = entry.fileParts[i];

                let fileIndex = ('000' + part.archiveIndex).slice(-3);
                let archivePath = stripPakLang(this.directoryPath).replace(/_dir\.vpk$/, '_' + fileIndex + '.vpk');

                let buf: Buffer = Buffer.alloc(part.entryLength)

                if(!this.readHandles[archivePath])
                    this.readHandles[archivePath] = await fs.promises.open(archivePath, 'r');

                await this.readHandles[archivePath].read(buf, 0, part.entryLength, part.entryOffset)

                if(!part.isCompressed) {
                    buf.copy(file, currentLength);
                } else {
                    let decompressedBuf: Buffer = lzham.decompress(buf, part.entryLengthUncompressed);
                    decompressedBuf.copy(file, currentLength);
                }
                currentLength += part.entryLengthUncompressed;

                if(i == 0 && path.endsWith('.wav')) {
                    if(!this.cams[archivePath]) {
                        let newCam = new CAM(archivePath);
                        newCam.read()
                        this.cams[archivePath] = newCam;
                    }

                    camEntry = this.cams[archivePath].entries.find(e => e.vpkContentOffset == part.entryOffset);
                }
            }
        }

        // Add wav headers
        if(patchWav && path.endsWith('.wav') && camEntry) {
            let checksum1 = file.subarray(4, 8);
            let checksum2 = file.subarray(8, 12);

            let firstByteIdx = 12;
            let padByte;
            padByte = file[firstByteIdx]
            while(padByte == 0xCB) {
                padByte = file[firstByteIdx]
                firstByteIdx++;
            }
            firstByteIdx -= 1;
            let lastByteIdx = file.byteLength - 1;
            padByte = file[lastByteIdx]
            while(padByte == 0xBC) {
                padByte = file[lastByteIdx]
                lastByteIdx--;
            }

            let headerSize = camEntry.headerSize;
            let realLength = headerSize + (2 * camEntry.sampleCount * camEntry.channels);

            file = file.subarray(headerSize, realLength+1)

            let sampleRate = camEntry?.sampleRate || 44100;
            let sampleDepth = 16;
            let channels = camEntry?.channels || 1
            let wavHeader = Buffer.alloc(44);
            wavHeader.writeUInt32BE(0x52494646, 0); // "RIFF"
            wavHeader.writeUInt32LE(file.byteLength - 8 + 44, 4); // File size
            wavHeader.writeUInt32BE(0x57415645, 8); // "WAVE"
            wavHeader.writeUInt32BE(0x666D7420, 12); // "fmt\20"
            wavHeader.writeUInt32LE(16, 16); // Format data length (the stuff above)
            wavHeader.writeUInt16LE(1, 20); // Type (PCM)
            wavHeader.writeUInt16LE(channels, 22); // Channels
            wavHeader.writeUInt32LE(sampleRate, 24); // Sample rate
            wavHeader.writeUInt32LE(sampleRate*sampleDepth*channels/8, 28); // Sample rate * sample depth * channels / 8
            wavHeader.writeUInt16LE(Math.ceil(sampleDepth/8)*channels, 32); // Sample depth * channels / 8
            wavHeader.writeUInt16LE(sampleDepth, 34); // Sample depth
            wavHeader.writeUInt32BE(0x64617461, 36); // "data"
            wavHeader.writeUInt32LE(file.byteLength, 40) // File size (data)

            file = Buffer.concat([wavHeader, file]);

            if(convertWavToOgg) {
                file = await new Promise(resolve => {
                    let firstStreamEnded = false;
                    let bufferStream = new PassThrough();
                    FFmpeg(Readable.from([file], { objectMode: false }))
                        .inputFormat('wav')
                        .audioChannels(channels)
                        .audioBitrate('160k')
                        .outputFormat('ogg')
                        .on('error', () => {
                            const outputBuffer = Buffer.concat(buffers);
                            resolve(outputBuffer);
                        })
                        .pipe(bufferStream);

                    // Read the passthrough stream
                    const buffers: Buffer[] = [];
                    bufferStream.on('data', function (buf) {
                        buffers.push(buf);
                    });
                    bufferStream.on('end', function () {
                        const outputBuffer = Buffer.concat(buffers);
                        resolve(outputBuffer);
                    });
                })
            }
        } else if (!path.endsWith('.wav') && crc32(file) !== entry.crc) {
            throw new Error('CRC does not match');
        }

        return file;
    }
}
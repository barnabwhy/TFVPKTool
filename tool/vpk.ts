import crc32 from "./crc";
import ReadBuffer from "./buffer";
import CAM from "./cam";

// const HEADER_1_LENGTH: number = 12;
// const HEADER_2_LENGTH: number = 28;
const HEADER_196610_LENGTH: number = 16;

const fs = require('fs');
const lzham = require('./build/Release/lzham.node')

function stripPakLang(directoryPath: string): string {
    let stripped: string = directoryPath.replace(/english|french|german|italian|japanese|korean|polish|portugese|russian|spanish|tchinese/, '');
    return stripped;
}

class VPKHeader {

    errors: string[] = [];

    // header data
    signature: number = NaN;
    version: number = NaN;
    treeLength: number = NaN;
    unknown1: number = NaN; // should en up as 0, maybe FileDataSectionSize (see https://developer.valvesoftware.com/wiki/VPK_File_Format#VPK_2)

    private directoryPath: string;

    constructor(path: string) {
        this.directoryPath = path;
    }

    read() {
        let r: ReadBuffer = new ReadBuffer(HEADER_196610_LENGTH, this.directoryPath);

        this.signature = r.readUInt32();
        this.version = r.readUInt32();
        this.treeLength = r.readUInt32();
        this.unknown1 = r.readUInt32();
    }

    isValid() {
        let valid = true;
    
        if(this.signature != 0x55aa1234) {
            this.errors.push("Invalid header signature");
            valid = false;
        }
        if(this.version != 196610) {
            this.errors.push("Invalid header version");
            valid = false;
        }
        if(this.treeLength == 0) {
            this.errors.push("Invalid tree length (0)");
            valid = false;
        }
        if(this.unknown1 != 0) {
            this.errors.push("unknown1 was not 0!");
            valid = false;
        }

        return valid;
    }
}

class VPKDirectoryEntry {

    crc: number;
    preloadBytes: number;
    preloadOffset: number = NaN;
    fileParts: VPKFilePartEntry[];

    constructor(r: ReadBuffer) {
        this.crc = r.readUInt32();
        // this.crc = r.readUInt32BE();
        this.preloadBytes = r.readUInt16()

        this.fileParts = [];
        let part = new VPKFilePartEntry(r);
        while (part.valid) {
            this.fileParts.push(part);
            if(!part.valid) break;
            part = new VPKFilePartEntry(r);
        }
        
        if (this.preloadBytes)
            this.preloadOffset = r.tell();
    }
}

interface VPKTreeFile {
    [key: string]: VPKDirectoryEntry
}

class VPKTree {
    files: VPKTreeFile = {};
    entries: any = {};
    numFiles: number = 0;

    hasRead: boolean = false;

    private directoryPath: string;

    constructor(path: string) {
        this.directoryPath = path;
    }
    read() {
        const stat = fs.statSync(this.directoryPath);
        let r: ReadBuffer = new ReadBuffer(stat.size, this.directoryPath);

        r.skip(HEADER_196610_LENGTH)

        while (true) {
            let extension = r.readString();

            if (extension === '') {
                break;
            }

            if (!this.entries[extension])
                this.entries[extension] = {};

            while (true) {
                let directory = r.readString();;

                if (directory === '') {
                    break;
                }

                if (!this.entries[extension][directory])
                    this.entries[extension][directory] = {};

                while (true) {
                    let filename = r.readString();

                    if (filename === '') {
                        break;
                    }

                    if (!this.entries[extension][directory][filename])
                    this.entries[extension][directory][filename] = {};

                    let fullPath = filename;
                    if (fullPath === ' ') {
                        fullPath = '';
                    }
                    if (extension !== ' ') {
                        fullPath += '.' + extension;
                    }
                    if (directory !== ' ') {
                        fullPath = directory + '/' + fullPath;
                    }

                    let entry = new VPKDirectoryEntry(r);

                    r.skip(entry.preloadBytes);

                    this.files[fullPath] = entry;
                    this.entries[extension][directory][filename] = entry;
                    this.numFiles++;
                }
            }
        }
        this.hasRead = true;
    }
}

enum EPackedLoadFlags
{
	LOAD_NONE,
	LOAD_VISIBLE      = 1 << 0,  // FileSystem visibility?
	LOAD_CACHE        = 1 << 8,  // Only set for assets not stored in the depot directory.
	LOAD_TEXTURE_UNK0 = 1 << 18,
	LOAD_TEXTURE_UNK1 = 1 << 19,
	LOAD_TEXTURE_UNK2 = 1 << 20,
};

enum EPackedTextureFlags
{
	TEXTURE_NONE,
	TEXTURE_DEFAULT         = 1 << 3,
	TEXTURE_ENVIRONMENT_MAP = 1 << 10,
};

class VPKFilePartEntry {
    archiveIndex: number;

    loadFlags: EPackedLoadFlags = EPackedLoadFlags.LOAD_NONE;
    textureFlags: EPackedTextureFlags = EPackedTextureFlags.TEXTURE_NONE; /// only vtfs
    entryOffset: number = NaN;
    entryLength: number = NaN;
    entryLengthUncompressed: number = NaN;

    isCompressed: boolean = false;

    valid: boolean = true;

    constructor(r: ReadBuffer) {
        this.archiveIndex = r.readUInt16();
        
        if (this.archiveIndex === 0xFFFF) {
            this.valid = false;
        } else {
            this.loadFlags = r.readUInt16();
            this.textureFlags = r.readUInt32();
            this.entryOffset = r.readUInt64();
            this.entryLength = r.readUInt64();
            this.entryLengthUncompressed = r.readUInt64();

            this.isCompressed = (this.entryLength != this.entryLengthUncompressed);
        }
    }
}

interface VPKCamList {
    [key: string]: CAM
}
interface VPKReadHandleList {
    [key: string]: any
}

export default class VPK {
    directoryPath: string;

    errors: string[] = [];
    header: VPKHeader;
    tree: VPKTree;

    cams: VPKCamList = {};
    readHandles: VPKReadHandleList = {};

    constructor(path: string) {
        this.directoryPath = path;

        this.tree = new VPKTree(this.directoryPath);
        this.header = new VPKHeader(this.directoryPath);

        if(this.isValid()) {
            this.header.read();
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
            this.tree.read();
    }
    
    get files() {
        return Object.keys(this.tree instanceof VPKTree ? this.tree.files : []);
    }

    close() {
        Promise.all(Object.values(this.readHandles).map(h => h.close()))
        .then(() => { this.readHandles = {} })
    }

    async readFile(path: string): Promise<Buffer | null> {
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
        if(path.endsWith('.wav') && camEntry) {
            let checksum = file.subarray(4, 12);

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

            let sampleRate = camEntry?.bitrate || 44100;
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
            wavHeader.writeUInt16LE(sampleDepth*channels/8, 32); // Sample depth * channels / 8
            wavHeader.writeUInt16LE(sampleDepth, 34); // Sample depth
            wavHeader.writeUInt32BE(0x64617461, 36); // "data"
            wavHeader.writeUInt32LE(file.byteLength, 40) // File size

            file = Buffer.concat([wavHeader, file]);

        } else if (crc32(file) !== entry.crc) {
            throw new Error('CRC does not match');
        }

        return file;
    }
}
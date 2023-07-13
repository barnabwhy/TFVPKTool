import { ReadBuffer } from "./buffer";

export enum EPackedLoadFlags
{
	LOAD_NONE,
	LOAD_VISIBLE      = 1 << 0,  // FileSystem visibility?
	LOAD_CACHE        = 1 << 8,  // Only set for assets not stored in the depot directory.
	LOAD_ACACHE_UNK0  = 1 << 10, // Acache uses this!!!
	LOAD_TEXTURE_UNK0 = 1 << 18,
	LOAD_TEXTURE_UNK1 = 1 << 19,
	LOAD_TEXTURE_UNK2 = 1 << 20,
};

export enum EPackedTextureFlags
{
	TEXTURE_NONE,
	TEXTURE_DEFAULT         = 1 << 3,
	TEXTURE_ENVIRONMENT_MAP = 1 << 10,
};

export class VPKFilePartEntry {
    archiveIndex: number = NaN;

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
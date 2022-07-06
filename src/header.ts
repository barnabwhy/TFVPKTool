import { ReadBuffer } from "./buffer";

// const HEADER_1_LENGTH: number = 12;
// const HEADER_2_LENGTH: number = 28;
export const HEADER_196610_LENGTH: number = 16;

export class VPKHeader {

    errors: string[] = [];

    // header data
    signature: number = NaN;
    version: number = NaN;
    treeLength: number = NaN;
    unknown1: number = NaN; // should en up as 0, maybe FileDataSectionSize (see https://developer.valvesoftware.com/wiki/VPK_File_Format#VPK_2)

    read(path: string) {
        let r: ReadBuffer = new ReadBuffer(HEADER_196610_LENGTH, path);

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
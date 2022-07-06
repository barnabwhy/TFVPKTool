import { ReadBuffer } from "./buffer";
import { HEADER_196610_LENGTH } from "./header";
import { VPKFilePartEntry } from "./filepart";

const fs = require('fs');

export class VPKDirectoryEntry {

    crc: number;
    preloadBytes: number;
    preloadOffset: number = NaN;
    fileParts: VPKFilePartEntry[];

    constructor(r: ReadBuffer) {
        this.crc = r.readUInt32();
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

export class VPKTree {
    files: VPKTreeFile = {};
    entries: any = {};
    numFiles: number = 0;

    hasRead: boolean = false;

    read(path: string) {
        const stat = fs.statSync(path);
        let r: ReadBuffer = new ReadBuffer(stat.size, path);

        r.skip(HEADER_196610_LENGTH)

        while (true) {
            let extension = r.readString();

            if (extension === '') {
                break;
            }

            if (!this.entries[extension])
                this.entries[extension] = {};

            while (true) {
                let directory = r.readString();

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
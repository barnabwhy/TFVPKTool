const { Worker } = require('worker_threads');
const { EventEmitter } = require('events');

export interface VPKCopyProgress {
    workerIdx: number,
    file: string,
    current: number,
    total: number
}

class CopyWorker extends EventEmitter {
    private self: (typeof Worker);

    vpkPath: string;

    constructor(vpkPath: string, patchWav: boolean = true) {
        super();

        this.vpkPath = vpkPath;

        this.self = new Worker(__dirname+'/worker.js', {
            workerData: {
                vpkPath,
                patchWav
            }
        });
        this.self.on("message", (msg: any) => { this.emit("message", msg) })
        this.self.on("error", (err: Error) => { this.emit("error", err) })
        this.self.on("exit", (code: number) => { this.emit("exit", code) })
    }

    copyFile(file: string, destination: string) {
        this.self.postMessage({ task: "copyFile", file, destination })
    }
    exit() {
        this.self.postMessage({ task: "exit" })
    }
}

enum VPKCopyMode {
    NONE = 0,
    COPY = 1
}

export class VPKCopy extends EventEmitter {
    workers: CopyWorker[];

    vpkPath: string;
    outPath: string = "";
    files: string[] = [];
    fileCount: number = 0;
    threads: number;
    patchWav: boolean;

    mode: VPKCopyMode = VPKCopyMode.NONE;
    taskResolve: Function | null = null;

    constructor(vpkPath: string, threads: number = 8, patchWav: boolean = true) {
        super();

        this.vpkPath = vpkPath;
        this.threads = threads;
        this.patchWav = patchWav;

        this.workers = [];
        for(let i = 0; i < threads; i++) {
            let worker = new CopyWorker(vpkPath, patchWav);
            worker.on("message", (msg: any) => { this.handleWorkerMsg(i, msg) })
            this.workers.push(worker);
        }
    }

    private handleWorkerMsg(i: number, msg: any) {
        if(this.mode == VPKCopyMode.COPY) {
            if(this.files.length > 0) {
                this.workerDoCopy(i, this.files.shift() as string)
            } else {
                this.mode = VPKCopyMode.NONE;
                if(this.taskResolve) this.taskResolve();
            }
        }
    }

    private workerDoCopy(i: number, file: string) {
        this.emit("progress", {
            workerIdx: i, 
            file,
            current: this.fileCount - this.files.length,
            total: this.fileCount
        })
        this.workers[i].copyFile(file, this.outPath+'/'+file);
    }

    copy(files: string[], outPath: string): Promise<void> {
        return new Promise(resolve => {
            this.files = [...files];
            this.fileCount = files.length
            this.outPath = outPath

            this.taskResolve = () => { this.taskResolve = null; resolve(); };
            if(files.length == 0) return this.taskResolve();

            this.mode = VPKCopyMode.COPY;

            for(let i = 0; i < this.files.length && i < this.workers.length; i++) {
                this.workerDoCopy(i, this.files.shift() as string)
            }

        })
    }
    close() {
        this.workers.forEach(worker => {
            worker.exit();
        })
    }
}
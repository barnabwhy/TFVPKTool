import { VPK } from "./vpk";
const fs = require('fs').promises;

const { workerData, parentPort } = require("worker_threads");

let vpk = new VPK(workerData.vpkPath);
vpk.readTree();

parentPort.on("message", async (msg: any) => {
    if (msg.task === "exit") {
        parentPort.close();
    } else {
        if(msg.task == "copyFile") {
            let { file, destination } = msg;
            if(workerData.convertWavToOgg && destination.endsWith('.wav'))
                destination = destination.replace(/\.wav$/, '.ogg');
            const data = await vpk.readFile(file, workerData.patchWav, workerData.convertWavToOgg)
            await fs.mkdir(destination.substring(0,destination.lastIndexOf("/")+1), { recursive: true });
            await fs.writeFile(destination, data);
            parentPort.postMessage({ type: 1 });
        }
    }
});
import VPK from "./vpk";
const fs = require('fs').promises;

const { workerData, parentPort } = require("worker_threads");

let vpk = new VPK(workerData.vpkPath);
vpk.readTree();

parentPort.on("message", async (msg: any) => {
    if (msg.task === "exit") {
        parentPort.close();
    } else {
        if(msg.task == "copyFile") {
            const { file, destination } = msg;
            const data = await vpk.readFile(file)
            await fs.mkdir(destination.substring(0,destination.lastIndexOf("/")+1), { recursive: true });
            await fs.writeFile(destination, data);
            parentPort.postMessage({ type: 1 });
        }
    }
});
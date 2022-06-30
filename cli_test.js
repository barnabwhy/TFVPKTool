const { VPK, VPKCopy } = require("./dist");

(async () => {
    let startTime = Date.now();

    const vpkName = "englishclient_mp_common.bsp.pak000_dir.vpk";
    const vpkPath = "D:\\SteamLibrary\\steamapps\\common\\Titanfall\\vpk\\" + vpkName;
    let vpk = new VPK(vpkPath);
    vpk.readTree();
    const files = Object.keys(vpk.tree.files).filter(f => f.startsWith("sound/campaign"));
    const outPath = "./out"

    let copier = new VPKCopy(vpkPath, 16);

    copier.on("progress", (data) => {
        console.log(`${data.current}/${data.total}\t | Worker ${("0"+data.workerIdx).slice(-2)} |\tCopying "${data.file}"`)
    });

    await copier.copy(files, outPath);

    copier.close();

    console.log(`Whole operation took: ${Date.now() - startTime}ms`)
})();
const VPKCopy = require("./dist/reader").default;
const VPK = require("./dist/vpk").default;

var clui = require("clui");
var thisProgressBar = new clui.Progress(50);

let log = require("log-with-statusbar")({
    initialStatusTextArray: [thisProgressBar.update(0, 100)]
});

(async () => {
    let startTime = Date.now();

    const vpkPath = "D:\\SteamLibrary\\steamapps\\common\\Titanfall\\vpk\\englishclient_mp_common.bsp.pak000_dir.vpk";
    let vpk = new VPK(vpkPath);
    vpk.readTree();
    const files = Object.keys(vpk.tree.files).filter(f => f.startsWith("sound/campaign"));
    const outPath = "./out"

    let copier = new VPKCopy(vpkPath, 16);

    copier.on("progress", (data) => {
        log.info(`${data.current}/${data.total}\t | Worker ${("0"+data.workerIdx).slice(-2)} |\tCopying "${data.file}"`)
        log.setStatusBarText([thisProgressBar.update(data.current - 1, data.total)]);
    });

    await copier.copy(files, outPath);

    log.disableStatusBar();

    copier.close();
    log.info(`Whole operation took: ${Date.now() - startTime}ms`)
})();
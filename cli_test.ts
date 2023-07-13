import { VPK, VPKCopy, VPKCopyProgress, VPacker } from "./src";

(async () => {
    let startTime = Date.now();

    const vpkName = "englishclient_mp_common.bsp.pak000_dir.vpk";
    const vpkPath = "F:\\SteamLibrary\\steamapps\\common\\Titanfall\\vpk\\" + vpkName;
    let vpk = new VPK(vpkPath);
    vpk.readTree();
    const files = Object.keys(vpk.tree.files).filter(f => f.startsWith("sound/campaign"));
    const outPath = "./out"

    let copier = new VPKCopy(vpkPath, 16);

    copier.on("progress", (data: VPKCopyProgress) => {
        console.log(`${data.current}/${data.total}\t | Worker ${("0"+data.workerIdx).slice(-2)} |\tCopying "${data.file}"`)
    });

    await copier.copy(files, outPath);

    copier.close();

    console.log(`Extracting took: ${Date.now() - startTime}ms`)

    startTime = Date.now();

    const newVpkName = "englishclient_audio_campaign.bsp.pak000_dir.vpk";
    let revpk = new VPacker();
    for (const file of files) {
        console.log(`Adding file ${outPath}/${file}`);
        await revpk.addFile(outPath + '/' + file, file)
    }

    revpk.writeVPK(outPath + '/' + newVpkName);

    console.log(`Packing took: ${Date.now() - startTime}ms`)
})();
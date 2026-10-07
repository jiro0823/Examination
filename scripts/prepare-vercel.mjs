import { copyFile, readFile, writeFile } from "node:fs/promises";

const indexPath = new URL("../index.html", import.meta.url);
const outputIndexPath = new URL("../dist/index.html", import.meta.url);
const sourceHtml = await readFile(indexPath, "utf8");
const deploymentHtml = sourceHtml
  .replace("./src/styles.css", "./styles.css")
  .replace("./node_modules/qrcodejs/qrcode.min.js", "./qrcode.min.js")
  .replace("./src/main.js", "./main.js");
const deploymentMain = (await readFile(new URL("../src/main.js", import.meta.url), "utf8"))
  .replace("../dist/domain/pos.js", "./domain/pos.js");

await Promise.all([
  writeFile(outputIndexPath, deploymentHtml),
  writeFile(new URL("../dist/main.js", import.meta.url), deploymentMain),
  copyFile(new URL("../src/styles.css", import.meta.url), new URL("../dist/styles.css", import.meta.url)),
  copyFile(
    new URL("../node_modules/qrcodejs/qrcode.min.js", import.meta.url),
    new URL("../dist/qrcode.min.js", import.meta.url),
  ),
]);

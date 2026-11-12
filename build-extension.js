/**
 * Build unpacked extension directories for direct browser loading.
 *
 * Input:  v3/ (Manifest V3 shared source), v2/firefox & v2/chrome (legacy V2 source)
 * Output: dist/ directory with browser-specific builds
 *
 * Targets:
 * - chromium-v3 : Edge, Chrome, Brave and all Chromium-based browsers
 *                (removes background.scripts to comply with Chromium Manifest V3)
 * - firefox-v3  : Firefox Manifest V3 (keeps full background.scripts)
 * - firefox-v2  : Legacy Firefox Manifest V2
 *
 * No npm dependencies required. Uses only Node.js built-in modules.
 */

const fs = require("fs");
const path = require("path");

function rmDir(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function mkdir(p) {
  fs.mkdirSync(p, { recursive: true });
}
function copyDir(from, to) {
  for (const name of fs.readdirSync(from)) {
    const f = path.join(from, name);
    const t = path.join(to, name);
    const st = fs.statSync(f);
    if (st.isDirectory()) {
      mkdir(t);
      copyDir(f, t);
    } else {
      fs.copyFileSync(f, t);
    }
  }
}
function build(srcDir, outDir, isChromiumV3 = false) {
  rmDir(outDir);
  mkdir(outDir);
  copyDir(srcDir, outDir);
  const mfPath = path.join(outDir, "manifest.json");
  const mf = JSON.parse(fs.readFileSync(mfPath, "utf8"));
  if (isChromiumV3 && mf.background?.scripts) {
    delete mf.background.scripts;
  }
  fs.writeFileSync(mfPath, JSON.stringify(mf, null, 2));
  console.log("Completed:", outDir);
}

const root = __dirname;
const buildRoot = path.join(root, "dist");
rmDir(buildRoot);
mkdir(buildRoot);

// 1. Chromium V3 (Edge / Chrome / Chromium-based browsers, Safari)
build(path.join(root, "v3"), path.join(buildRoot, "chromium-v3"), true);
// 2. Firefox V3 (keep background.scripts)
build(path.join(root, "v3"), path.join(buildRoot, "firefox-v3"), false);
// 3. Firefox V2 (legacy manifest v2 for older Firefox)
build(
  path.join(root, "v2", "firefox"),
  path.join(buildRoot, "firefox-v2"),
  false,
);

console.log("\nAll targets built successfully. Output directory:", buildRoot);

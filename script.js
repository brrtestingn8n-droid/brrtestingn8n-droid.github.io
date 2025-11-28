//-----------------------------------------------------
// NORMALISE TEXT (plural → singular, cleanup)
//-----------------------------------------------------
function normalizeText(str) {
    str = str.toLowerCase().trim();

    // common plural → singular rules
    str = str.replace(/\bboxes\b/g, "box");
    str = str.replace(/\bchairs\b/g, "chair");
    str = str.replace(/\bpictures\b/g, "picture");
    str = str.replace(/\bmirrors\b/g, "mirror");
    str = str.replace(/\brugs\b/g, "rug");
    str = str.replace(/\bbedsides\b/g, "bedside");
    str = str.replace(/\bbaskets\b/g, "basket");
    str = str.replace(/\bsuitcases\b/g, "suitcase");

    // X pictures → X picture
    str = str.replace(/(\d+)\s+pictures/g, "$1 picture");

    return str;
}

//-----------------------------------------------------
// DETECT QUANTITY
//-----------------------------------------------------
function detectQty(str) {
    let qty = 1;

    // "3 x item", "3x item", "item x3"
    let m = str.match(/(\d+)\s*x/);
    if (m) return parseInt(m[1]);

    // "3 item"
    m = str.match(/^(\d+)\s+/);
    if (m) return parseInt(m[1]);

    return qty;
}

//-----------------------------------------------------
// VERY SAFE MATCHING — avoids false positives
//-----------------------------------------------------
function smartDictionaryMatch(clean) {
    let bestKey = null;
    let bestScore = 999;

    for (const key in window.volumeDict) {

        // hard exact substring match first
        if (clean.includes(key)) return key;

        // multi-word keys MUST fully appear
        const keyWords = key.split(" ");
        let allFound = keyWords.every(w => clean.includes(w));
        if (allFound) return key;

        // skip fuzzy for keys shorter than 4 chars
        if (key.length < 4) continue;

        // low fuzzy threshold
        const dist = levenshtein(clean, key);
        if (dist < bestScore) {
            bestScore = dist;
            bestKey = key;
        }
    }

    // return fuzzy only if distance extremely low
    return bestScore <= 1 ? bestKey : null;
}

//-----------------------------------------------------
// DIMENSIONS
//-----------------------------------------------------
function parseDimensions(text) {
    const m = text.match(/(\d+)\s*[xX]\s*(\d+)\s*[xX]\s*(\d+)/);
    if (!m) return null;
    const L = parseInt(m[1]), W = parseInt(m[2]), H = parseInt(m[3]);
    return Math.round((L * W * H) / 1728);
}

//-----------------------------------------------------
// PARSE ONE ITEM
//-----------------------------------------------------
function parseItem(raw) {
    if (!raw.trim()) return 0;

    let line = normalizeText(raw);
    const qty = detectQty(line);

    // try dimensions
    const dimVol = parseDimensions(line);
    if (dimVol) return qty * dimVol;

    // remove numbers before matching words
    line = line.replace(/^\d+\s*x?\d*\s*/g, "").trim();

    const key = smartDictionaryMatch(line);
    if (!key) return 0;

    return qty * window.volumeDict[key];
}

//-----------------------------------------------------
// VOLUME CALC
//-----------------------------------------------------
function calculateVolume() {
    const raw = document.getElementById("items").value;

    const parts = raw
        .toLowerCase()
        .replace(/\n/g, ",")
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);

    let total = 0;
    for (const p of parts) total += parseItem(p);

    return total;
}

//-----------------------------------------------------
// MEN & VEHICLE RULES
//-----------------------------------------------------
function getVehicle(v) {
    if (v <= 200) return "Transit Van";
    if (v <= 500) return "Luton Van";
    if (v <= 750) return "Large Luton Van";
    if (v <= 1000) return "Two Luton Vans";
    if (v <= 1400) return "Two Large Luton Vans";
    return "Mixed Fleet";
}

function getMen(v) {
    if (v <= 550) return 2;
    if (v <= 750) return 3;
    if (v <= 1000) return 3;
    if (v <= 1400) return 4;
    return 4;
}

//-----------------------------------------------------
// MAIN BTN
//-----------------------------------------------------
document.getElementById("btnCalc").onclick = () => {
    const v = Math.round(calculateVolume());
    const men = getMen(v);
    const veh = getVehicle(v);

    document.getElementById("output").innerText =
        `📦 Volume: ${v} cu ft\n👷 Men: ${men}\n🚚 Vehicle: ${veh}`;
};

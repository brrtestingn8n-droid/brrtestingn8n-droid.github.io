//-----------------------------------------------------
// NORMALISE TEXT
//-----------------------------------------------------
function normalizeText(str) {
    str = str.toLowerCase().trim();
    str = str.replace(/\bsofas\b/g, "sofa");
    str = str.replace(/\bboxes\b/g, "box");
    str = str.replace(/\bchairs\b/g, "chair");
    str = str.replace(/\bpictures\b/g, "picture");
    str = str.replace(/\bmirrors\b/g, "mirror");
    str = str.replace(/\brugs\b/g, "rug");
    str = str.replace(/\bbedsides\b/g, "bedside");
    str = str.replace(/\bbaskets\b/g, "basket");
    str = str.replace(/\bsuitcases\b/g, "suitcase");
    str = str.replace(/(\d+)\s+pictures/g, "$1 picture");
    return str;
}

//-----------------------------------------------------
// DETECT QUANTITY
//-----------------------------------------------------
function detectQty(str) {
    let qty = 1;
    let m;

    // "3 x item" or "3x item"
    m = str.match(/^(\d+)\s*x\s*/);
    if (m) return parseInt(m[1]);

    // "3 item" at start
    m = str.match(/^(\d+)\s+/);
    if (m) return parseInt(m[1]);

    // "item x3" at end
    m = str.match(/x\s*(\d+)$/);
    if (m) return parseInt(m[1]);

    return qty;
}

//-----------------------------------------------------
// SMART DICTIONARY MATCH
//-----------------------------------------------------
function smartDictionaryMatch(clean) {
    if (window.volumeDict[clean]) return clean;

    for (const key in window.volumeDict) {
        const keyWords = key.split(" ");
        if (keyWords.every(w => clean.includes(w))) return key;
    }

    // Fallback: fuzzy match (levenshtein must exist)
    let bestKey = null;
    let bestScore = Infinity;

    for (const key in window.volumeDict) {
        if (key.length < 4) continue;
        const dist = levenshtein(clean, key);
        if (dist < bestScore) {
            bestScore = dist;
            bestKey = key;
        }
    }

    return bestScore <= 1 ? bestKey : null;
}

//-----------------------------------------------------
// DIMENSIONS PARSER
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
    line = line.replace(/^(\d+\s*x\s*|\d+\s+|x\d+\s*)/, "").trim();

    const dimVol = parseDimensions(line);
    if (dimVol) return qty * dimVol;

    const key = smartDictionaryMatch(line);
    if (!key) return 0;

    return qty * window.volumeDict[key];
}

//-----------------------------------------------------
// CALCULATE TOTAL VOLUME
//-----------------------------------------------------
function calculateVolume() {
    const raw = document.getElementById("items").value;
    const parts = raw
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    let total = 0;
    for (const p of parts) total += parseItem(p);
    return total;
}

//-----------------------------------------------------
// VEHICLE & MEN RULES
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
// BUTTON HANDLER
//-----------------------------------------------------
document.getElementById("btnCalc").onclick = () => {
    const v = Math.round(calculateVolume());
    const men = getMen(v);
    const veh = getVehicle(v);

    document.getElementById("output").innerText =
        `📦 Volume: ${v} cu ft\n👷 Men: ${men}\n🚚 Vehicle: ${veh}`;
};

//-----------------------------------------------------
// LEVENSHTEIN DISTANCE FUNCTION (for fuzzy matching)
//-----------------------------------------------------
function levenshtein(a, b) {
    if (!a || !b) return (a || b).length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
            else matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + 1
            );
        }
    }
    return matrix[b.length][a.length];
}

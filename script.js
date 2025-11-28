// ----------------------
//    LEVENSHTEIN
// ----------------------
function levenshtein(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1)
      );
    }
  }
  return matrix[b.length][a.length];
}

// ----------------------
//   FUZZY LOOKUP
// ----------------------
function fuzzyLookup(text) {
  let bestItem = null;
  let bestScore = 999;

  const t = text.toLowerCase().trim();

  for (const key in window.volumeDict) {
    const d = levenshtein(t, key);
    if (d < bestScore) {
      bestScore = d;
      bestItem = key;
    }
  }

  return bestScore <= 3 ? bestItem : null;
}

// ----------------------
//   PARSE DIMENSIONS
// ----------------------
function parseDimensions(text) {
  const m = text.match(/(\d+)\s*[xX]\s*(\d+)\s*[xX]\s*(\d+)/);
  if (!m) return null;

  const L = parseInt(m[1]);
  const W = parseInt(m[2]);
  const H = parseInt(m[3]);

  return Math.round((L * W * H) / 1728);
}

// ----------------------
//   PARSE QUANTITY
// ----------------------
function detectQty(str) {
  let qty = 1;

  if (/^\d+/.test(str)) qty = parseInt(str);

  if (/x\s*\d+$/.test(str)) qty = parseInt(str.match(/x\s*(\d+)$/)[1]);

  if (/\d+\s*x/.test(str)) qty = parseInt(str.match(/(\d+)\s*x/)[1]);

  return qty;
}

// ----------------------
//   PARSE INDIVIDUAL ITEM
// ----------------------
function parseItem(raw) {
  let line = raw.toLowerCase().trim();
  if (!line) return 0;

  const qty = detectQty(line);

  const dimVol = parseDimensions(line);
  if (dimVol) return qty * dimVol;

  const best = fuzzyLookup(line);
  if (best) return qty * window.volumeDict[best];

  return 0;
}

// ----------------------
//   VOLUME CALCULATOR
// ----------------------
function calculateVolume() {

  const rawInput = document.getElementById("items").value;

  const lines = rawInput
    .toLowerCase()
    .replace(/\n/g, ",")
    .split(/[,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  let total = 0;
  for (const line of lines) total += parseItem(line);

  return total;
}

// ----------------------
//   MEN / VAN RULES
// ----------------------
function getVehicle(v) {
  if (v <= 200) return "Transit Van";
  if (v <= 500) return "Luton Van";
  if (v <= 750) return "Large Luton Van";
  if (v <= 1000) return "Two Luton Vans";
  if (v <= 1400) return "Two Large Luton Vans";
  return "Mixed Fleet (Large Move)";
}

function getMen(v) {
  if (v <= 550) return 2;
  if (v <= 750) return 3;
  if (v <= 1000) return 3;
  if (v <= 1400) return 4;
  return 4;
}

// ----------------------
//    MAIN OUTPUT
// ----------------------
function calculateQuote() {
  const vol = Math.round(calculateVolume());
  const men = getMen(vol);
  const van = getVehicle(vol);

  document.getElementById("output").innerText =
    `📦 Volume: ${vol} cu ft\n👷 Men Required: ${men}\n🚚 Vehicle: ${van}`;
}

document.getElementById("btnCalc").onclick = calculateQuote;

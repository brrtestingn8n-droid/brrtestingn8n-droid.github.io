// --- SCRIPT.JS ---
// Improved fuzzy matching + quantity detection + van/crew estimator

// 1. Normalise string
function normalise(str) {
    return str
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// 2. Extract quantity from any English form
function getQuantity(str) {
    str = str.toLowerCase();
    
    // direct numbers
    let num = str.match(/(^|\s)(\d+)(?=\s|x|$)/);
    if (num) return parseInt(num[2]);

    // "2 x item"
    let numX = str.match(/(\d+)\s*x/);
    if (numX) return parseInt(numX[1]);

    // basic words
    const words = {
        "one": 1, "a": 1, "an": 1,
        "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10
    };

    for (let w in words) {
        if (str.includes(" " + w + " ")) return words[w];
    }

    return 1; // default
}

// 3. Fuzzy match against dictionary
function fuzzyMatch(input, dictionary) {
    input = normalise(input);
    let bestMatch = null;
    let bestScore = 0;

    Object.keys(dictionary).forEach(key => {
        let keyNorm = normalise(key);

        // token score
        let inputTokens = input.split(" ");
        let keyTokens = keyNorm.split(" ");

        let score = 0;
        inputTokens.forEach(t => {
            if (keyTokens.includes(t)) score += 1;
        });

        // partial matches (sofa vs corner sofa)
        if (keyNorm.includes(input) || input.includes(keyNorm)) score += 1;

        if (score > bestScore) {
            bestScore = score;
            bestMatch = key;
        }
    });

    // fallback small volume
    return bestMatch ? bestMatch : null;
}

// 4. Calculate total volume
function calculateVolume(inputText) {
    const lines = inputText
        .split(/\n|,/)
        .map(l => l.trim())
        .filter(l => l.length > 0);

    let total = 0;
    let breakdown = [];

    lines.forEach(line => {
        const qty = getQuantity(line);
        const query = normalise(line.replace(/^\d+\s*x?/, "").trim());

        const match = fuzzyMatch(query, window.volumeDict);

        if (match) {
            let vol = window.volumeDict[match] * qty;
            total += vol;
            breakdown.push({
                item: match,
                qty,
                itemVolume: window.volumeDict[match],
                subtotal: vol
            });
        } else {
            // unknown entry — assume small misc item
            let vol = 5 * qty;
            total += vol;
            breakdown.push({
                item: query,
                qty,
                itemVolume: 5,
                subtotal: vol,
                guessed: true
            });
        }
    });

    return { total, breakdown };
}

// 5. Van & crew recommendation
function getVanAndCrew(cuft) {
    if (cuft < 250) return { van: "Small Van", crew: 1 };
    if (cuft < 500) return { van: "Medium Van", crew: 1 };
    if (cuft < 850) return { van: "Luton Van", crew: 2 };
    if (cuft < 1300) return { van: "Large Luton Van", crew: 3 };
    if (cuft < 1800) return { van: "Two Lutons", crew: 3 };
    return { van: "7.5t Truck", crew: 4 };
}

// 6. UI handler
document.getElementById("calculateBtn").addEventListener("click", () => {
    const input = document.getElementById("itemsInput").value;

    const result = calculateVolume(input);
    const rec = getVanAndCrew(result.total);

    let output = `
        <strong>Total Volume:</strong> ${result.total} cu ft<br>
        <strong>Recommended Van:</strong> ${rec.van}<br>
        <strong>Crew:</strong> ${rec.crew} movers<br><br>
        <strong>Breakdown:</strong><br>
    `;

    result.breakdown.forEach(b => {
        output += `${b.qty} × ${b.item} = ${b.subtotal} cu ft`;
        if (b.guessed) output += " (guessed)";
        output += "<br>";
    });

    document.getElementById("result").innerHTML = output;
});

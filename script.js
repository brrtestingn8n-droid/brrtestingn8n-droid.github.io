// ----------------------------------------------------
// scripts.js
// Contains Levenshtein, fuzzy lookup, and the main calculator logic.
// ----------------------------------------------------

// --- Original Functions (Code 1) ---

/**
 * Calculates the Levenshtein distance between two strings (a and b).
 */
function levenshtein(a, b) {
  // Handle empty strings for robustness
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = [];
  // Initialize matrix
  for (let i = 0; i <= b.length; i++) m[i] = [i];
  for (let j = 0; j <= a.length; j++) m[0][j] = j;

  // Fill in the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      m[i][j] = Math.min(
        m[i - 1][j] + 1, // Deletion
        m[i][j - 1] + 1, // Insertion
        m[i - 1][j - 1] + (a[j - 1] === b[i - 1] ? 0 : 1) // Substitution/Match
      );
    }
  }
  return m[b.length][a.length];
}

/**
 * Finds the best matching key in window.volumeDict for the given item string.
 */
function fuzzyLookup(item) {
  let best = null,
    bestScore = 999;
  const target = item.toLowerCase().trim(); // Convert input to lowercase

  for (const key in window.volumeDict) {
    // Keys in volumeDict are already lowercase (Code 2 best practice)
    const d = levenshtein(target, key);

    // Require closer match for short words
    if (target.length <= 5 && d > 1) continue;

    if (d < bestScore) {
      bestScore = d;
      best = key;
    }
  }

  // Only consider a match if the score is low (max 2 differences)
  return bestScore <= 2 ? best : null;
}

// --- New Calculation Logic ---

// Constants for simple quote calculation
const BASE_RATE_PER_VOLUME = 0.85; // Example base rate
const PACKING_COST_MULTIPLIER = 0.5; // 50% extra for packing labor
const DISMANTLE_COST_PER_ITEM = 30; // Flat fee per dismantle item
const FLOOR_PENALTY_RATE = 0.05; // 5% cost increase per floor without a lift

/**
 * Calculates the total quote based on user inputs.
 */
function calculateQuote() {
  const itemsText = document.getElementById('items').value;
  const items = itemsText.split('\n').filter(line => line.trim() !== ''); // Split by line, ignore empty lines

  // --- 1. Volume Calculation ---
  let totalVolume = 0;
  let matches = 0;
  let unmatchedItems = [];

  for (const item of items) {
    const matchedKey = fuzzyLookup(item);
    if (matchedKey) {
      totalVolume += window.volumeDict[matchedKey];
      matches++;
    } else {
      unmatchedItems.push(item);
    }
  }

  // --- 2. Cost Calculation ---
  let baseVolumeCost = totalVolume * BASE_RATE_PER_VOLUME;
  let totalCost = baseVolumeCost;
  let breakdown = {
    volume: baseVolumeCost,
    packing: 0,
    dismantle: 0,
    floorPenalty: 0,
  };

  // --- 3. Service Costs ---
  const isPacking = document.getElementById('packing').checked;
  const dismantleCount = parseInt(document.getElementById('dismantleCount').value) || 0;

  if (isPacking) {
    breakdown.packing = baseVolumeCost * PACKING_COST_MULTIPLIER;
    totalCost += breakdown.packing;
  }

  if (dismantleCount > 0) {
    breakdown.dismantle = dismantleCount * DISMANTLE_COST_PER_ITEM;
    totalCost += breakdown.dismantle;
  }

  // --- 4. Floor/Access Penalty (Pickup) ---
  const pickupFloor = parseInt(document.getElementById('pickupFloor').value) || 0;
  const hasPickupLift = document.getElementById('pickupLift').value.toLowerCase().includes('y');

  if (pickupFloor > 0 && !hasPickupLift) {
    // Only apply penalty if floor > 0 AND no lift
    const penalty = totalCost * (pickupFloor * FLOOR_PENALTY_RATE);
    breakdown.floorPenalty += penalty;
    totalCost += penalty;
  }

  // --- 5. Generate Output ---
  let outputHTML = `
    <h4>✅ **Quote Calculation Summary**</h4>
    <p>Items Matched: **${matches}** / ${items.length}</p>
    <p>Total Estimated Volume: **${totalVolume.toFixed(2)}** units</p>
    <hr>
    <p>🚚 **Base Moving Cost (Volume):** $${breakdown.volume.toFixed(2)}</p>
    `;

  if (breakdown.packing > 0) {
    outputHTML += `<p>📦 **Packing Service Cost:** $${breakdown.packing.toFixed(2)}</p>`;
  }
  if (breakdown.dismantle > 0) {
    outputHTML += `<p>🛠️ **Dismantling/Reassembly:** $${breakdown.dismantle.toFixed(2)} (${dismantleCount} items)</p>`;
  }
  if (breakdown.floorPenalty > 0) {
    outputHTML += `<p>🪜 **Access Penalty (Floors/No Lift):** $${breakdown.floorPenalty.toFixed(2)}</p>`;
  }

  outputHTML += `
    <hr style="border-top: 2px solid #1b3c7a;"/>
    <h3>💰 **TOTAL ESTIMATED QUOTE: $${totalCost.toFixed(2)}**</h3>
  `;

  if (unmatchedItems.length > 0) {
    outputHTML += `<br><p style="color:red; font-weight:bold;">⚠️ Could not find a match for: ${unmatchedItems.join(', ')}</p>`;
  }

  document.getElementById('output').innerHTML = outputHTML;
}


// --- Event Listener ---
// Wait for the entire document to load before attaching the listener
document.addEventListener('DOMContentLoaded', () => {
  const calcButton = document.getElementById('btnCalc');
  if (calcButton) {
    calcButton.addEventListener('click', calculateQuote);
  }
});

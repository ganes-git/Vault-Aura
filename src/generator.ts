import { GeneratedKey, AlphaConfig, PassphraseConfig, PinConfig, KeyStrength } from './types';
import { WORDLIST } from './wordlist';

/**
 * Ironclad Cryptographic Randomness Generator
 * NEVER routes through Math.random() to avoid predictable entropy states.
 */
export function cryptoRandom(max: number): number {
  if (max <= 0) return 0;
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  return array[0] % max;
}

/**
 * Calculates base-2 logarithm for entropy computations
 */
function log2(val: number): number {
  return Math.log(val) / Math.LN2;
}

/**
 * Generates an alphanumeric high-entropy cryptographic key
 */
export function generateAlphanumeric(config: AlphaConfig): GeneratedKey {
  // Clamp length to 256 for standard security limits
  const length = Math.min(Math.max(config.length, 8), 256);

  let pool = "";
  if (config.uppercase) pool += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (config.lowercase) pool += "abcdefghijklmnopqrstuvwxyz";
  if (config.numbers)   pool += "0123456789";
  if (config.symbols)   pool += "!@#$%";

  // Guard: if all options are disabled, force active state on uppercase
  if (pool.length === 0) {
    pool = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  }

  // Handle ambiguous character exclusion: (0, O, 1, l, I)
  if (config.excludeAmbiguous) {
    const ambiguous = ['0', 'O', '1', 'l', 'I'];
    pool = pool.split("").filter(char => !ambiguous.includes(char)).join("");
  }

  // Final fallback check if pool is empty after exclusion (very rare)
  if (pool.length === 0) {
    pool = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // ambiguous-free fallback
  }

  // Construct key using cryptoRandom
  let value = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = cryptoRandom(pool.length);
    value += pool[randomIndex];
  }

  return computeTelemetry(value, pool.length, length, 'alphanumeric');
}

/**
 * Generates a human-readable high-entropy passphrase
 */
export function generatePassphrase(config: PassphraseConfig): GeneratedKey {
  const wordCount = Math.min(Math.max(config.wordCount, 3), 12);
  const words: string[] = [];

  for (let i = 0; i < wordCount; i++) {
    const wordIndex = cryptoRandom(WORDLIST.length);
    let word = WORDLIST[wordIndex];

    // Handle Capitalization formatting
    if (config.capitalization === 'uppercase') {
      word = word.toUpperCase();
    } else if (config.capitalization === 'titlecase') {
      word = word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    } else {
      word = word.toLowerCase();
    }

    words.push(word);
  }

  const separator = config.separator;
  const value = words.join(separator);

  // Pool size is 2,048 (size of WORDLIST)
  return computeTelemetry(value, WORDLIST.length, wordCount, 'passphrase');
}

/**
 * Generates a PIN Block with optional sequence/repetition filtering
 */
export function generatePin(config: PinConfig): GeneratedKey {
  const length = config.length;
  let attempts = 0;
  const maxAttempts = 1000;
  let pin = "";

  while (attempts < maxAttempts) {
    attempts++;
    let digits = "";
    for (let i = 0; i < length; i++) {
      digits += cryptoRandom(10).toString();
    }

    // Exclude sequential patterns (e.g. 123, 321, 000, 999)
    if (config.excludeSequential && hasSequentialPatterns(digits)) {
      continue;
    }

    // Exclude repeated blocks: reject if any 2-digit pair repeats more than twice
    if (config.excludeRepeated && hasRepeatedBlocks(digits)) {
      continue;
    }

    pin = digits;
    break;
  }

  // Fallback if filter is too tight (safely break lock)
  if (!pin) {
    for (let i = 0; i < length; i++) {
      pin += cryptoRandom(10).toString();
    }
  }

  // Formatted PIN Block
  let value = pin;
  if (config.format === 'grouped' && length > 4) {
    const chunks: string[] = [];
    for (let i = 0; i < length; i += 4) {
      chunks.push(pin.substring(i, i + 4));
    }
    value = chunks.join("-");
  }

  // Pool size is 10 (digits 0-9)
  return computeTelemetry(value, 10, length, 'pin');
}

/**
 * Checks for sequential digit configurations of size 3 (e.g. 123, 321, 000, 999)
 */
function hasSequentialPatterns(digits: string): boolean {
  if (digits.length < 3) return false;

  for (let i = 0; i < digits.length - 2; i++) {
    const a = parseInt(digits[i]);
    const b = parseInt(digits[i + 1]);
    const c = parseInt(digits[i + 2]);

    // Equal digits (e.g. 111, 000)
    if (a === b && b === c) return true;

    // Ascending patterns (e.g. 123, 789)
    if (b === a + 1 && c === b + 1) return true;

    // Descending patterns (e.g. 321, 987)
    if (b === a - 1 && c === b - 1) return true;
  }
  return false;
}

/**
 * Detects repeating 2-digit pairs in Pin Blocks (e.g. 12 appearing 3 times)
 */
function hasRepeatedBlocks(digits: string): boolean {
  if (digits.length < 4) return false;

  const pairCounts: { [key: string]: number } = {};

  for (let i = 0; i < digits.length - 1; i++) {
    const pair = digits.substring(i, i + 2);
    pairCounts[pair] = (pairCounts[pair] || 0) + 1;
    if (pairCounts[pair] > 2) {
      return true;
    }
  }
  return false;
}

/**
 * Core entropy metrics computation
 */
function computeTelemetry(value: string, poolSize: number, length: number, mode: 'alphanumeric' | 'passphrase' | 'pin'): GeneratedKey {
  // Shannon Entropy: H = L * log2(N)
  const entropy = parseFloat((length * log2(poolSize)).toFixed(1));

  // Keyspace size: N^L
  let keyspace = 0n;
  try {
    keyspace = BigInt(poolSize) ** BigInt(length);
  } catch {
    // Safety fallback for extremely high scales
    keyspace = 1000000000000000000n;
  }

  // Strength Rating thresholds
  let strength: KeyStrength = 'WEAK';
  if (mode === 'pin') {
    if (length >= 10) {
      strength = 'UNBREAKABLE';
    } else if (length >= 6) {
      strength = 'STRONG';
    } else {
      strength = 'FAIR';
    }
  } else {
    if (entropy >= 128) {
      strength = 'UNBREAKABLE';
    } else if (entropy >= 80) {
      strength = 'STRONG';
    } else if (entropy >= 40) {
      strength = 'FAIR';
    }
  }

  // Crack Time estimation
  const crackTime = computeCrackTime(poolSize, length);

  return {
    value,
    entropy,
    keyspace,
    crackTime,
    strength,
    mode,
    timestamp: Date.now()
  };
}

/**
 * Computes estimated cracking duration under 10^12 guesses per second GPU cluster
 */
function computeCrackTime(N: number, L: number): string {
  // Logarithmic calculations to bypass float overflow limits
  // Seconds = (N^L) / 10^12
  // log10(Seconds) = L * log10(N) - 12
  const logSeconds = L * Math.log10(N) - 12;

  if (logSeconds < 0) {
    return "Instantly";
  }

  // Convert logSeconds back to raw float or exponential string
  if (logSeconds < 1.778) { // < 60 seconds
    const sec = Math.round(Math.pow(10, logSeconds));
    return `${sec} second${sec !== 1 ? 's' : ''}`;
  }

  const logMinutes = logSeconds - Math.log10(60);
  if (logMinutes < 1.778) { // < 60 minutes
    const min = Math.round(Math.pow(10, logMinutes));
    return `${min} minute${min !== 1 ? 's' : ''}`;
  }

  const logHours = logMinutes - Math.log10(60);
  if (logHours < 1.38) { // < 24 hours
    const hr = Math.round(Math.pow(10, logHours));
    return `${hr} hour${hr !== 1 ? 's' : ''}`;
  }

  const logDays = logHours - Math.log10(24);
  if (logDays < 2.56) { // < 365 days
    const day = Math.round(Math.pow(10, logDays));
    return `${day} day${day !== 1 ? 's' : ''}`;
  }

  const logYears = logDays - Math.log10(365.25);
  if (logYears < 3) { // < 1,000 years
    const yr = Math.round(Math.pow(10, logYears));
    return `${yr} year${yr !== 1 ? 's' : ''}`;
  }

  const logMillennia = logYears - 3;
  if (logMillennia < 6) { // < 1,000,000 Millennia (1 Billion Years)
    const mil = Math.round(Math.pow(10, logMillennia));
    return `${formatCommas(mil)} millennia`;
  }

  // Astronomical timescales: Billion Years, Trillions, or exponential
  const logBillionYears = logYears - 9;
  if (logBillionYears < 6) {
    const bil = Math.pow(10, logBillionYears).toFixed(1);
    return `${bil} billion years`;
  }

  return `10^${Math.floor(logBillionYears + 9)} years`;
}

/**
 * Format commas for large integers
 */
function formatCommas(val: number): string {
  return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

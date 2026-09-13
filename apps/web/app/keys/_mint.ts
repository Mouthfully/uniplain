/**
 * MINTING AN API KEY, AND THE THREE THINGS THAT DECIDE ITS SHAPE.
 *
 * ================================================================================================
 * THE HASH IS NOT COMPUTED HERE
 * ================================================================================================
 *
 * `@repo/store`'s `hashApiKey` is the function `verify_api_key` is fed by at the edge, and it is
 * the function used here. A second SHA-256 written in this file would compile, pass its own test,
 * and mint keys the Worker cannot verify -- a customer holding a credential that is refused
 * everywhere, with nothing in either half saying which one is wrong. The rule is not "use SHA-256",
 * it is "use the same function", including its `\x` bytea framing.
 *
 * ================================================================================================
 * THE PREFIX IS THE FIRST SIXTEEN CHARACTERS OF THE KEY, NOT A SEPARATE FACT
 * ================================================================================================
 *
 * `api_keys.key_prefix` is checked against `^mp_(live|test)_[a-z0-9]{8}$` and is described as a
 * "non-secret display prefix, e.g. 'mp_live_a1b2c3d4'". It is what a customer reads in a list to
 * tell two keys apart. Deriving it from the key rather than generating it separately is what makes
 * "this row is that key" true: two independent random draws would put a prefix in the table that
 * names no key anybody holds.
 *
 * `live` AND NOT `test`. The column permits both and this product has no test mode: there is no
 * sandbox, no fixture tenant, and no path where a `test` key behaves differently from a `live` one.
 * A key labelled test that does exactly what a live key does is a label that lies, and the customer
 * who believes it is the one who pastes it into something public. When a sandbox exists, this is
 * the line that changes, and `_mint.test.ts` is what will notice.
 *
 * ================================================================================================
 * THE ALPHABET IS UNAMBIGUOUS, AND THAT IS NOT COSMETIC
 * ================================================================================================
 *
 * Lowercase letters and digits, with `l`, `o` and their digit twins removed from the DISPLAY half.
 * A customer reads the prefix off a screen and types it into a support message; `mp_live_l0l0...`
 * is a sentence nobody can transcribe. The SECRET half keeps the full alphabet, because nobody
 * retypes it and every removed character is entropy given away.
 *
 * The secret half is 40 characters of a 36-symbol alphabet, which is over 200 bits. The relevant
 * number is not the length but the source: `crypto.getRandomValues`, rejected-sampled so the
 * modulo does not tilt the distribution. A biased key generator is the defect nothing observes.
 */

/** The display half: no `l`, no `o`, no `0`, no `1`. Transcribable out loud. */
const DISPLAY_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
/** The secret half: everything, because nobody reads it aloud. */
const SECRET_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

const DISPLAY_LENGTH = 8;
const SECRET_LENGTH = 40;

export interface MintedKey {
  /** The full credential. Shown once, never stored, never logged. */
  readonly key: string;
  /** The non-secret display half, exactly as `api_keys.key_prefix` will hold it. */
  readonly prefix: string;
}

/**
 * Random characters from an alphabet, WITHOUT modulo bias.
 *
 * `bytes[i] % alphabet.length` is the obvious line and it is wrong: 256 is not a multiple of 32 or
 * 36, so the first few symbols come up more often than the last few. The skew is small, invisible,
 * and permanent -- it makes every key this product ever issues slightly guessable in a way no test
 * anybody would write can see. Rejecting the values above the largest whole multiple costs a few
 * extra bytes and removes the question.
 */
function randomChars(alphabet: string, length: number, random: RandomSource): string {
  const limit = Math.floor(256 / alphabet.length) * alphabet.length;
  let out = "";
  while (out.length < length) {
    const bytes = new Uint8Array(length * 2);
    random.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      out += alphabet[byte % alphabet.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** The slice of `crypto` this needs. A parameter so a test can feed it a known sequence. */
export interface RandomSource {
  getRandomValues<T extends Uint8Array>(array: T): T;
}

export function mintApiKey(random: RandomSource): MintedKey {
  const prefix = `mp_live_${randomChars(DISPLAY_ALPHABET, DISPLAY_LENGTH, random)}`;
  return { key: `${prefix}_${randomChars(SECRET_ALPHABET, SECRET_LENGTH, random)}`, prefix };
}

/** The shape `api_keys.key_prefix` is checked against, repeated here so a test can hold both. */
export const KEY_PREFIX_PATTERN = /^mp_(live|test)_[a-z0-9]{8}$/;

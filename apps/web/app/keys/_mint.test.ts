import { hashApiKey } from "@repo/store/jwt";
import { describe, expect, it } from "vitest";

import { KEY_PREFIX_PATTERN, type RandomSource, mintApiKey } from "./_mint";

/**
 * WHAT A MINTED KEY HAS TO BE TRUE OF, AND WHY EACH ONE IS INVISIBLE WITHOUT A TEST.
 *
 *   THE PREFIX MUST SATISFY THE COLUMN'S CHECK. `key_prefix` is constrained to
 *   `^mp_(live|test)_[a-z0-9]{8}$`. A generator that drifts outside it fails at the database with a
 *   constraint violation the customer sees as "the key could not be made" -- correct, and
 *   impossible to diagnose from the screen.
 *
 *   THE PREFIX MUST BE A PREFIX OF THE KEY. It is a display handle for a credential; drawn
 *   independently it would name no key anybody holds, and the table would be a list of rows nobody
 *   can match to anything.
 *
 *   THE HASH MUST BE WHAT THE EDGE COMPUTES. `hashApiKey` from `@repo/store` is what feeds
 *   `verify_api_key`. Writing a second SHA-256 in the minting path would mint credentials the
 *   Worker refuses, with neither half able to say which was wrong. This asserts the real function
 *   produces the shape the column accepts.
 *
 *   THE ALPHABET MUST NOT BE BIASED. `byte % alphabet.length` is the obvious line and it tilts the
 *   distribution, permanently and invisibly. The rejection is asserted against a fed sequence.
 */

/** A random source that hands out exactly the bytes it is given, then repeats them. */
function fixedRandom(bytes: readonly number[]): RandomSource {
  let index = 0;
  return {
    getRandomValues<T extends Uint8Array>(array: T): T {
      for (let i = 0; i < array.length; i += 1) {
        array[i] = bytes[index % bytes.length] ?? 0;
        index += 1;
      }
      return array;
    },
  };
}

describe("minting an API key", () => {
  const minted = mintApiKey(crypto);

  it("produces a prefix the column's own check accepts", () => {
    expect(minted.prefix).toMatch(KEY_PREFIX_PATTERN);
  });

  it("makes the prefix the start of the key, not a separate draw", () => {
    expect(minted.key.startsWith(`${minted.prefix}_`)).toBe(true);
  });

  it("keeps the secret half out of the prefix", () => {
    // The prefix is stored in the clear and shown in a table. If the key were merely the prefix,
    // the table would be a credential store.
    expect(minted.key.length).toBeGreaterThan(minted.prefix.length + 30);
  });

  it("draws a different key every time", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i += 1) seen.add(mintApiKey(crypto).key);
    expect(seen.size).toBe(50);
  });

  it("hashes to the 32-byte bytea literal the schema and the edge both expect", async () => {
    const hash = await hashApiKey(minted.key, crypto);
    // `\x` plus 64 hex characters: `key_hash bytea not null check (octet_length(key_hash) = 32)`,
    // and `verify_api_key` refuses anything that is not exactly 32 bytes.
    expect(hash).toMatch(/^\\x[0-9a-f]{64}$/);
  });

  it("leaves out the characters a person cannot transcribe", () => {
    // The prefix is what somebody reads off a screen into a support message. `l`, `o`, `0` and `1`
    // are the four that turn that into a guess. Checked over many draws rather than one, because a
    // single key might legitimately contain none of them.
    let all = "";
    for (let i = 0; i < 200; i += 1) all += mintApiKey(crypto).prefix.slice("mp_live_".length);
    expect(all).not.toMatch(/[lo01]/);
    expect(all.length).toBe(200 * 8);
  });

  it("rejects the bytes that would bias the SECRET alphabet rather than folding them in", () => {
    // THIS ASSERTION WAS WRITTEN AGAINST THE WRONG HALF FIRST, and the failure is the useful part.
    // The display alphabet has 32 symbols and 256 is a whole multiple of 32, so `% 32` is already
    // uniform and the rejection never fires there -- the guard is real but unreachable on that
    // draw. The SECRET alphabet has 36, and 256 is not a multiple of 36: the largest whole multiple
    // is 252, so 252 through 255 must be skipped or the first four symbols come up more often for
    // ever.
    //
    // A source alternating 255 and 0 therefore yields nothing but the 0 character in the secret
    // half. A `% 36` implementation would emit `255 % 36 = 3` alongside it.
    const minted = mintApiKey(fixedRandom([255, 0]));
    const secret = minted.key.slice(minted.prefix.length + 1);
    expect(secret).toMatch(/^a+$/);
    expect(secret.length).toBe(40);
  });

  it("draws the display half from an alphabet whose size divides 256", () => {
    // Stated as a property rather than left implicit, because it is the reason the test above
    // could not be written against the prefix. If the display alphabet ever gains or loses a
    // character, the rejection starts mattering there too and this line says so.
    const alphabet = new Set(
      Array.from({ length: 200 }, () => mintApiKey(crypto).prefix.slice("mp_live_".length)).join(
        "",
      ),
    );
    expect(256 % alphabet.size).toBe(0);
  });
});

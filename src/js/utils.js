
// Removed module-level random to fix potential scope issues
// PRNG state is now managed inside the Deck instance themselves.

export function getFreshSeed() {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        const array = new Uint32Array(1);
        window.crypto.getRandomValues(array);
        return array[0];
    }
    return (Date.now() ^ (Math.floor(Math.random() * 0xFFFFFFFF))) >>> 0;
}

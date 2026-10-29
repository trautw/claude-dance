# 02: One time through on placeholder dancers

**What to build:** The crib of Mairi's Wedding is encoded as data, and eight coloured capsules (Couples A–D, man and woman distinguishable) dance one 40-bar time through: dancing couple turns RH, casts, turns LH 1¼ to face 1st corners; half diagonal reels of four with 1st then 2nd corners, twice; reels of three across (woman with the couple above, man with the couple below); 2s/1s/3s circle six hands round and back. Each dancer's floor position and facing is a function of the bar (see ADR 0001). Timing comes from an audio clock with a metronome click; a bare bar counter shows the current bar.

**Blocked by:** 01

**Status:** done

- [x] Floor paths are computed at runtime from the crib data, not baked (ADR 0001)
- [x] Dancers travel along smooth, plausible paths at one step per bar; nobody teleports
- [x] Automated tests assert each dancer's place and facing at every figure boundary
- [x] The bar counter and metronome agree with dancer motion; the audio clock is the master clock
- [x] The couple in 4th place stands still throughout

# 05: The band's tune

**What to build:** An original 40-bar reel (not the traditional Mairi's Wedding melody) is synthesised with the Web Audio API as a Scottish dance band: accordion and fiddle on the melody, piano vamp, drums. It plays once per time through, plus the chords, replacing the metronome. It follows pause, jump and speed changes without drifting from the dancers.

**Blocked by:** 02

**Status:** done

- [x] All sound is generated in code with Web Audio; no audio files
- [x] The tune is 40 bars, reel tempo about 112 bpm at 1×, and phrase endings line up with figure boundaries
- [x] Opening and closing chords sound on cue
- [x] After any jump the music picks up from the target bar in sync with the dancers
- [x] At 0.5× and 0.75× the music actually slows down and stays in sync
- [x] Audio starts only after a user gesture

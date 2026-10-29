// The crib of "Mairi's Wedding" (James B. Cosh), as data.
// Bars are 1-based and inclusive, counted within one time through.
// "1s" here means the dancing couple, "2s"/"3s" the couples in the next two places.
// Shoulders as danced here: between half reels the 1s pass each other by the left in the middle;
// they pass by the right going into the reels of three, and start each reel of three by giving
// the right shoulder to their 2nd corner (1st woman to 2nd man, 1st man to 3rd woman).

export const CRIB = {
  title: "Mairi's Wedding",
  musicType: 'Reel',
  barsPerTimeThrough: 40,
  timesThrough: 8,
  // The band's chord before and after the dance, for the bow and curtsey.
  chordBars: 2,
  // Each couple leads twice: from 1st place, then from 2nd place, after which they step down
  // to the bottom in bars 39–40 as the circle finishes.
  dancingCouplePlaces: [1, 2, 1, 2, 1, 2, 1, 2],
  figures: [
    { bars: [1, 2], kind: 'turnRightHand', name: 'Turn right hand' },
    { bars: [3, 4], kind: 'castOff', name: 'Cast off one place, 2s step up' },
    { bars: [5, 8], kind: 'turnLeftHandToCorners', name: 'Turn left hand 1¼ to face 1st corners' },
    { bars: [9, 12], kind: 'halfDiagonalReel', corner: 1, name: 'Half diagonal reel of four with 1st corners' },
    { bars: [13, 16], kind: 'halfDiagonalReel', corner: 2, name: 'Half diagonal reel of four with 2nd corners' },
    { bars: [17, 20], kind: 'halfDiagonalReel', corner: 3, name: 'Half diagonal reel of four with 1st corners, in 3rd corner positions' },
    { bars: [21, 24], kind: 'halfDiagonalReel', corner: 4, name: 'Half diagonal reel of four with 2nd corners, in 4th corner positions' },
    { bars: [25, 32], kind: 'reelsOfThreeAcross', name: 'Reels of three across' },
    { bars: [33, 40], kind: 'circleSix', name: 'Circle six hands round and back' },
  ],
};

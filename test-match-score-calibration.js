import assert from 'node:assert/strict';

import {
  calibrateDisplayScore,
  DISPLAY_BAND_COMMON,
  DISPLAY_BAND_HIGH,
  DISPLAY_BAND_HIDDEN
} from './lib/services/match-score-calibration.js';

function run() {
  const hidden = calibrateDisplayScore({ trueScore: 20 });
  assert.equal(hidden.displayBand, DISPLAY_BAND_HIDDEN);
  assert.equal(hidden.visible, false);
  assert.ok(hidden.displayScore >= 60 && hidden.displayScore <= 69);

  const common = calibrateDisplayScore({ trueScore: 72 });
  assert.equal(common.displayBand, DISPLAY_BAND_COMMON);
  assert.ok(common.displayScore >= 70 && common.displayScore <= 89);
  assert.ok(common.displayScore < 90);

  const high = calibrateDisplayScore({ trueScore: 90 });
  assert.equal(high.displayBand, DISPLAY_BAND_HIGH);
  assert.ok(high.displayScore >= 90 && high.displayScore <= 100);

  const commonLow = calibrateDisplayScore({ trueScore: 58 });
  const commonHigh = calibrateDisplayScore({ trueScore: 81 });
  assert.ok(commonLow.displayScore < commonHigh.displayScore);
  assert.ok(commonLow.displayScore >= 70);
  assert.ok(commonHigh.displayScore <= 89);

  const highLow = calibrateDisplayScore({ trueScore: 82 });
  const highHigh = calibrateDisplayScore({ trueScore: 98 });
  assert.ok(highLow.displayScore >= 90);
  assert.ok(highLow.displayScore < highHigh.displayScore);

  const blocked = calibrateDisplayScore({
    trueScore: 95,
    constraintFlags: { remoteOnlyMismatch: true }
  });
  assert.equal(blocked.displayBand, DISPLAY_BAND_HIDDEN);
  assert.ok(blocked.displayScore <= 69);

  console.log('match-score calibration checks passed');
}

run();

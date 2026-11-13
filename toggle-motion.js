/* Backwards-compatible selection entry point. The shared control stylesheet
 * animates each native choice's fill from left to right. No second indicator,
 * layout measurements or permanent document/resize observers are needed. */
(function (global) {
  'use strict';
  if (global.PolicyToggleMotion) return;
  function refresh() { global.PolicyButtonMotion?.mount(global.document).refresh(); }
  function scan() { refresh(); }
  global.PolicyToggleMotion = Object.freeze({ scan, refresh });
})(window);

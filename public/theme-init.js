// Apply the saved theme before first paint to avoid a light-mode flash.
// Loaded as an external script so CSP can strictly enforce `script-src 'self'`
// without `'unsafe-inline'`.
;(function () {
  try {
    var t = window.localStorage.getItem('studystreak.v1:theme')
    if (
      t === 'dark' ||
      (t === 'system' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      document.documentElement.classList.add('dark')
    }
  } catch (_) {
    /* storage may be unavailable */
  }
})()

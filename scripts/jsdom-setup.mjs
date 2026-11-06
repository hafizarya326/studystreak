/**
 * jsdom environment preload for the smoke test.
 * Usage: node --import ./scripts/jsdom-setup.mjs <bundle>
 *
 * Runs before the app bundle so all browser globals exist by the time React,
 * recharts and the app modules initialise.
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM(
  '<!doctype html><html><head></head><body><div id="root"></div></body></html>',
  { url: 'http://localhost:5173/', pretendToBeVisual: true },
)

const { window } = dom

const setGlobal = (key, value) => {
  try {
    globalThis[key] = value
  } catch {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true })
  }
}

setGlobal('window', window)
setGlobal('document', window.document)
setGlobal('self', window)
setGlobal('localStorage', window.localStorage)
setGlobal('sessionStorage', window.sessionStorage)

for (const key of [
  'HTMLElement',
  'HTMLInputElement',
  'HTMLSelectElement',
  'HTMLTextAreaElement',
  'Element',
  'Node',
  'Event',
  'MouseEvent',
  'KeyboardEvent',
  'CustomEvent',
  'DOMRect',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'CSS',
]) {
  if (key in window) setGlobal(key, window[key])
}

// matchMedia is not implemented in jsdom.
window.matchMedia = (query) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener() {},
  removeEventListener() {},
  addListener() {},
  removeListener() {},
  dispatchEvent() {
    return false
  },
})

// recharts' ResponsiveContainer needs ResizeObserver.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
setGlobal('ResizeObserver', ResizeObserverStub)
window.ResizeObserver = ResizeObserverStub

// Browsers APIs we call defensively.
window.scrollTo = () => {}
window.alert = () => {}
if (!window.Element.prototype.scrollIntoView) {
  window.Element.prototype.scrollIntoView = () => {}
}

// Notification is only used when the user opts in.
class NotificationStub {
  static permission = 'denied'
  static requestPermission = async () => 'denied'
  constructor() {}
}
setGlobal('Notification', NotificationStub)
window.Notification = NotificationStub

// React testing flag (suppresses act() warnings).
setGlobal('IS_REACT_ACT_ENVIRONMENT', true)

/**
 * Scroll lock utility — prevents body scrolling when modals/drawers are open.
 * Tracks lock count so nested modals don't unlock prematurely.
 */
let lockCount = 0
let scrollY = 0

export function lockScroll() {
  lockCount++
  if (lockCount === 1) {
    scrollY = window.scrollY
    document.body.classList.add('overflow-locked')
    document.body.style.top = `-${scrollY}px`
  }
}

export function unlockScroll() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.classList.remove('overflow-locked')
    document.body.style.top = ''
    window.scrollTo(0, scrollY)
  }
}

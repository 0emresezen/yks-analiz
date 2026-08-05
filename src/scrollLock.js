let isLocked = false
let savedScrollY = 0

export const syncBodyScrollLock = () => {
  const anyOpen = document.querySelector('.modal-overlay:not(.hidden)')

  if (anyOpen && !isLocked) {
    isLocked = true
    savedScrollY = window.scrollY
    document.documentElement.classList.add('scroll-locked')
    document.body.classList.add('scroll-locked')
    document.body.style.top = `-${savedScrollY}px`
    return
  }

  if (!anyOpen && isLocked) {
    isLocked = false
    document.documentElement.classList.remove('scroll-locked')
    document.body.classList.remove('scroll-locked')
    document.body.style.top = ''
    window.scrollTo(0, savedScrollY)
  }
}

const preventBackdropScroll = (event) => {
  if (event.target.classList?.contains('modal-overlay')) {
    event.preventDefault()
  }
}

export const initModalScrollLock = () => {
  const overlays = document.querySelectorAll('.modal-overlay')

  overlays.forEach((overlay) => {
    new MutationObserver(() => syncBodyScrollLock()).observe(overlay, {
      attributes: true,
      attributeFilter: ['class'],
    })

    overlay.addEventListener('wheel', preventBackdropScroll, { passive: false })
    overlay.addEventListener('touchmove', preventBackdropScroll, { passive: false })
  })

  syncBodyScrollLock()
}

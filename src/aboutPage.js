import { BRAND_NAME } from './brand.js'
import { LEGAL_SECTIONS, getLegalSection } from './legalContent.js'

let activeSectionId = 'overview'
let activateTabFn = null
let initialized = false

const getAboutEls = () => ({
  sidebar: document.getElementById('about-sidebar'),
  content: document.getElementById('about-content'),
})

const renderSidebar = (container) => {
  if (!container) return

  container.innerHTML = `
    <p class="about-sidebar-title">${BRAND_NAME}</p>
    <nav class="about-nav" aria-label="Yasal bilgiler">
      ${LEGAL_SECTIONS.map((section) => `
        <button
          type="button"
          class="about-nav-btn${section.id === activeSectionId ? ' active' : ''}"
          data-about-section="${section.id}"
          aria-current="${section.id === activeSectionId ? 'page' : 'false'}"
        >${section.title}</button>
      `).join('')}
    </nav>
  `
}

const renderAllSections = (container) => {
  if (!container) return

  container.innerHTML = LEGAL_SECTIONS.map((section) => `
    <article
      class="legal-article legal-section${section.id === activeSectionId ? ' is-active' : ''}"
      id="legal-${section.id}"
      data-legal-section="${section.id}"
      ${section.id === activeSectionId ? '' : 'hidden'}
    >
      <h2 class="legal-article-title">${section.title}</h2>
      <div class="legal-article-body">${section.content}</div>
    </article>
  `).join('')
}

const updateVisibleSection = () => {
  const { sidebar, content } = getAboutEls()
  if (!content) return

  content.querySelectorAll('[data-legal-section]').forEach((article) => {
    const isActive = article.dataset.legalSection === activeSectionId
    article.classList.toggle('is-active', isActive)
    article.hidden = !isActive
  })

  sidebar?.querySelectorAll('[data-about-section]').forEach((btn) => {
    const isActive = btn.dataset.aboutSection === activeSectionId
    btn.classList.toggle('active', isActive)
    btn.setAttribute('aria-current', isActive ? 'page' : 'false')
  })
}

const ensureInitialized = () => {
  if (initialized) return true

  const { sidebar, content } = getAboutEls()
  if (!sidebar || !content) return false

  renderSidebar(sidebar)
  renderAllSections(content)
  initialized = true
  return true
}

export const showAboutSection = (sectionId) => {
  if (!ensureInitialized()) return

  activeSectionId = getLegalSection(sectionId).id
  updateVisibleSection()

  const article = document.getElementById(`legal-${activeSectionId}`)
  article?.scrollIntoView({ block: 'start' })
}

export const openAboutSection = (sectionId) => {
  if (typeof activateTabFn === 'function') {
    activateTabFn('tab-about')
  }
  showAboutSection(sectionId)

  if (window.location.hash !== `#legal-${activeSectionId}`) {
    window.history.replaceState(null, '', `#legal-${activeSectionId}`)
  }

  const aboutTab = document.getElementById('tab-about')
  aboutTab?.scrollIntoView({ block: 'start' })
}

export const renderAboutPage = () => {
  if (!ensureInitialized()) return
  updateVisibleSection()
}

const handleAboutTrigger = (event) => {
  const trigger = event.target.closest('[data-about-section]')
  if (!trigger) return

  event.preventDefault()
  openAboutSection(trigger.dataset.aboutSection)
}

export const setupAboutPage = ({ activateTab }) => {
  activateTabFn = activateTab

  document.addEventListener('click', handleAboutTrigger)

  if (ensureInitialized()) {
    updateVisibleSection()
  }

  const hashSection = window.location.hash.replace(/^#legal-/, '')
  if (hashSection && getLegalSection(hashSection).id === hashSection) {
    openAboutSection(hashSection)
  }
}

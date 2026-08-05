import DOMPurify from 'dompurify'

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export const escapeHtml = (value) => {
  if (value == null) return ''
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch])
}

export const escapeAttr = escapeHtml

export const sanitizePlainText = (value) => {
  if (value == null) return ''
  return DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
}

export const sanitizeRichHtml = (value) => DOMPurify.sanitize(value || '')

const PLAIN_TEXT_ITEM_FIELDS = [
  'university',
  'department',
  'faculty',
  'city',
  'language',
  'tuition_status',
  'full_name',
  'location',
  'notes',
  'degree',
  'score_type',
  'transport_desc',
  'uniar_desc',
  'prestige_desc',
  'academic_desc',
  'transport_data_note',
  'uniar_data_note',
  'prestige_data_note',
  'academic_data_note'
]

export const sanitizeProgramStrings = (item) => {
  if (!item || typeof item !== 'object') return item

  const sanitized = { ...item }

  PLAIN_TEXT_ITEM_FIELDS.forEach((field) => {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizePlainText(sanitized[field])
    }
  })

  if (typeof sanitized.ai_eval === 'string') {
    sanitized.ai_eval = sanitizeRichHtml(sanitized.ai_eval)
  }

  return sanitized
}

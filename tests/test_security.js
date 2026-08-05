import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, escapeAttr } from '../src/security.js'

test('escapeHtml neutralizes script tags', () => {
  const payload = '<img src=x onerror=alert(1)>'
  assert.equal(escapeHtml(payload), '&lt;img src=x onerror=alert(1)&gt;')
})

test('escapeAttr prevents attribute breakout', () => {
  const payload = '"><script>alert(1)</script>'
  assert.equal(escapeAttr(payload), '&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
})

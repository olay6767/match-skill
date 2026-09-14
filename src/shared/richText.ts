const allowedTags = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote', 'h2', 'h3', 'a', 'div', 'span'])

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function safeLink(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? value : null
  } catch {
    return null
  }
}

export function sanitizeRichTextHtml(value: string) {
  if (!value.trim()) return ''
  if (typeof document === 'undefined') return escapeHtml(value)
  if (!/<\/?[a-z][\s\S]*>/i.test(value)) return escapeHtml(value).replace(/\r?\n/g, '<br>')

  const template = document.createElement('template')
  template.innerHTML = value
  const clean = (node: Node) => {
    Array.from(node.childNodes).forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return
      const element = child as HTMLElement
      clean(element)
      const tag = element.tagName.toLowerCase()
      if (!allowedTags.has(tag)) {
        if (['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math'].includes(tag)) element.remove()
        else element.replaceWith(...Array.from(element.childNodes))
        return
      }
      const href = tag === 'a' ? safeLink(element.getAttribute('href')) : null
      const alignment = element.style.textAlign
      const textColor = element.style.color
      const rawLineHeight = element.style.lineHeight
      const numericLineHeight = Number(rawLineHeight)
      Array.from(element.attributes).forEach((attribute) => element.removeAttribute(attribute.name))
      if (href) {
        element.setAttribute('href', href)
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'noopener noreferrer')
      } else if (tag === 'a') {
        element.replaceWith(...Array.from(element.childNodes))
        return
      }
      if (['left', 'center', 'right', 'justify'].includes(alignment)) element.style.textAlign = alignment
      if (textColor) element.style.color = textColor
      if (Number.isFinite(numericLineHeight) && numericLineHeight >= 0.8 && numericLineHeight <= 3) element.style.lineHeight = String(numericLineHeight)
    })
  }
  clean(template.content)
  return template.innerHTML
}

export function richTextToPlainText(value: string | null | undefined) {
  if (!value) return ''
  if (typeof document === 'undefined') return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const container = document.createElement('div')
  container.innerHTML = sanitizeRichTextHtml(value).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h2|h3|li|blockquote)>/gi, '\n')
  return (container.textContent ?? '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

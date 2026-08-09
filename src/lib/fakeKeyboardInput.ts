/** Helpers so the desktop mock keyboard can drive controlled React inputs. */

export type TextField = HTMLInputElement | HTMLTextAreaElement

export function isTextField(el: EventTarget | null): el is TextField {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
}

function setNativeValue(el: TextField, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
  const desc = Object.getOwnPropertyDescriptor(proto, 'value')
  desc?.set?.call(el, value)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}

export function insertIntoFocusedField(text: string) {
  const el = document.activeElement
  if (!isTextField(el) || el.readOnly || el.disabled) return false
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const next = el.value.slice(0, start) + text + el.value.slice(end)
  setNativeValue(el, next)
  const caret = start + text.length
  try {
    el.setSelectionRange(caret, caret)
  } catch {
    /* some input types reject selection */
  }
  return true
}

export function deleteFromFocusedField() {
  const el = document.activeElement
  if (!isTextField(el) || el.readOnly || el.disabled) return false
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  if (start !== end) {
    setNativeValue(el, el.value.slice(0, start) + el.value.slice(end))
    try {
      el.setSelectionRange(start, start)
    } catch {
      /* ignore */
    }
    return true
  }
  if (start <= 0) return false
  setNativeValue(el, el.value.slice(0, start - 1) + el.value.slice(end))
  try {
    el.setSelectionRange(start - 1, start - 1)
  } catch {
    /* ignore */
  }
  return true
}

export function pressEnterOnFocusedField() {
  const el = document.activeElement
  if (!isTextField(el) || el.readOnly || el.disabled) return false
  el.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
  )
  return true
}

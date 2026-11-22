import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Markdown } from './Markdown'

/** Renders the component to HTML so we can assert the structure the model's Markdown produces. */
const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />)

describe('Markdown', () => {
  it('renders bold, bullets and headings', () => {
    const out = html('## Plan\n\nUse **STAR** for this:\n\n- Situation\n- Action')
    expect(out).toContain('<strong>STAR</strong>')
    expect(out).toContain('<li>Situation</li>')
    expect(out).toContain('<h2>Plan</h2>')
  })

  it('renders inline code and fenced code blocks', () => {
    const out = html('Call `reverse()` like:\n\n```python\ndef reverse(x):\n    return x\n```')
    expect(out).toContain('class="inline-code"')
    expect(out).toContain('code-block')
    expect(out).toContain('code-lang')
  })

  it('shows link text but not a clickable anchor', () => {
    const out = html('See [the docs](https://example.com)')
    expect(out).toContain('the docs')
    expect(out).not.toContain('<a ')
  })

  it('does not pass through raw HTML (safe)', () => {
    const out = html('Hello <img src=x onerror=alert(1)>')
    expect(out).not.toContain('<img')
  })
})

import { memo, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import hljs from 'highlight.js/lib/common'

/** A fenced code block with syntax highlighting (highlight.js auto-detects the language). */
function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null)
  const lang = /language-(\w+)/.exec(className ?? '')?.[1]
  const code = String(children ?? '')

  useEffect(() => {
    const el = ref.current
    if (!el) return
    try {
      const result = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }) : hljs.highlightAuto(code)
      el.innerHTML = result.value
    } catch {
      el.textContent = code
    }
  }, [code, lang])

  return (
    <pre className="code-block">
      {lang && <span className="code-lang">{lang}</span>}
      <code ref={ref} className="hljs">
        {code}
      </code>
    </pre>
  )
}

/**
 * Renders assistant answers as clean Markdown: bold, bullets, headings, inline code and
 * highlighted code blocks. react-markdown does not allow raw HTML, so model output is safe.
 */
export const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            // Inline code has no language class and no newline; block code is fenced.
            const isBlock = /language-/.test(className ?? '') || String(children).includes('\n')
            if (isBlock) return <CodeBlock className={className}>{children}</CodeBlock>
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            )
          },
          a({ children }) {
            // Overlay has no browser; show link text only, never a clickable navigation.
            return <span className="md-link">{children}</span>
          }
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})

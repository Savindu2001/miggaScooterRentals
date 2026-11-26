/** Render agreement text: "## " lines become headings, every other non-empty line a paragraph. */
export function AgreementText(p: { text: string }) {
  return (
    <div>
      {p.text.split('\n').map((line) => {
        const l = line.trim()
        if (!l) return null
        if (l.startsWith('## ')) return <h3>{l.slice(3)}</h3>
        return <p>{l}</p>
      })}
    </div>
  )
}

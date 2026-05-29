/* Regex-based JSON syntax highlighter — safe for our controlled API output */
function syntaxHighlight(obj) {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2)
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        return /:$/.test(match)
          ? `<span class="json-key">${match}</span>`
          : `<span class="json-string">${match}</span>`
      }
      if (/true|false/.test(match)) return `<span class="json-bool">${match}</span>`
      if (/null/.test(match))       return `<span class="json-null">${match}</span>`
      return `<span class="json-number">${match}</span>`
    }
  )
}

export default function JsonViewer({ data, maxLines = 600 }) {
  if (data === null || data === undefined) return null

  const raw   = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  const lines = raw.split('\n')
  const shown = lines.slice(0, maxLines)
  const clipped = lines.length > maxLines

  return (
    <div className="relative">
      <table className="w-full text-[11px] leading-5 font-mono border-collapse">
        <tbody>
          {shown.map((line, i) => (
            <tr key={i} className="group hover:bg-slate-800/30">
              <td className="select-none w-10 pr-3 text-right text-slate-600 group-hover:text-slate-500
                             border-r border-slate-800 sticky left-0 bg-slate-900">
                {i + 1}
              </td>
              <td
                className="pl-4 whitespace-pre"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(line) }}
              />
            </tr>
          ))}
        </tbody>
      </table>
      {clipped && (
        <div className="px-4 py-2 text-[10px] text-slate-600 font-mono border-t border-slate-800">
          … {lines.length - maxLines} more lines truncated
        </div>
      )}
    </div>
  )
}

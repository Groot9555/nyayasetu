// Renders plain text answers with simple headings ("Heading:") and "- " bullets. No HTML injection.
const HEADING_RE = /^(Explanation|Potentially relevant provisions|General options \/ next steps|Please verify|Uncertainty):\s*(.*)$/i;

export default function FormattedText({ text }) {
  const blocks = [];
  let list = null;
  text.split('\n').forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/) || line.match(/^\s*\d+\.\s+(.*)$/);
    if (bullet) {
      if (!list) {
        list = [];
        blocks.push(<ul key={`ul-${i}`}>{list}</ul>);
      }
      list.push(<li key={i}>{bullet[1]}</li>);
      return;
    }
    list = null;
    if (!line.trim()) return;
    const h = line.replace(/^#+\s*|\*\*/g, '').match(HEADING_RE);
    if (h) {
      blocks.push(<h4 key={i} className="answer-heading">{h[1]}</h4>);
      if (h[2]) blocks.push(<p key={`${i}-p`}>{h[2]}</p>);
    } else {
      blocks.push(<p key={i}>{line.replace(/\*\*/g, '')}</p>);
    }
  });
  return <div className="formatted">{blocks}</div>;
}

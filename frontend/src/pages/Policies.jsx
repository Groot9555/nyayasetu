export function Privacy() {
  return (
    <div className="container page prose">
      <h1>Privacy</h1>
      <ul>
        <li>No registration or login is required.</li>
        <li>Questions, descriptions, and complaint details are sent to the NyayaSetu server only to process your request and are not saved to a database.</li>
        <li>If the server operator enables an AI provider, your question and the retrieved passages are sent to that provider to generate the answer. Avoid entering sensitive personal information.</li>
        <li>Complaint PDFs are generated in memory and returned to your browser; they are not stored.</li>
        <li>Standard server logs may record technical details (time, route, status code), not the content of your request.</li>
      </ul>
    </div>
  );
}

export function Disclaimer() {
  return (
    <div className="container page prose">
      <h1>Disclaimer</h1>
      <p>
        NyayaSetu provides general legal information for educational purposes. It is <strong>not legal advice</strong>,
        does not create a lawyer–client relationship, and is not an official government service.
      </p>
      <p>
        Answers are produced from a limited set of indexed documents and may be incomplete, outdated, or incorrect.
        AI-generated text is never guaranteed to be accurate. Always verify information with the official source
        and consult a qualified lawyer or the appropriate authority before acting.
      </p>
      <p>Complaint drafts are templates. Review every detail and confirm the correct authority before submitting anything.</p>
    </div>
  );
}

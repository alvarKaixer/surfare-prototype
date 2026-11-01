export default function ImageProvenance({ result }: any) {
  if (!result) return null;
  return (
    <details className="image-provenance" aria-label="Image origin metadata">
      <summary>
        <span>Image origin</span>
        <strong>{result.title}</strong>
      </summary>
      {result.findings.map((finding: any) => (
        <p key={finding.code}>{finding.message}</p>
      ))}
      {result.credentials && (
        <p>
          A Content Credentials marker is present. Its signature and claims have not been verified;
          this alone does not establish AI use.
        </p>
      )}
      {!result.findings.length && !result.credentials && (
        <p>No supported origin marker was found. This does not establish how the image was made.</p>
      )}
      <p>Metadata only, read locally from your original file.</p>
      <ul>
        {[...result.notes, ...result.limitations].map((note: string) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
      <a href="https://contentcredentials.org/verify" target="_blank" rel="noreferrer">
        Open Content Credentials verifier
      </a>
      <small>Select the original file there separately. Nothing is uploaded automatically.</small>
    </details>
  );
}

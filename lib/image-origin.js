export function imageOriginVerdict(metadata, visual) {
  const codes = (metadata?.findings || []).map((f) => f.code);
  if (
    codes.some((code) =>
      ['ai-declaration', 'generation-settings', 'generation-workflow'].includes(code),
    )
  )
    return {
      label: 'AI-generated',
      confidence: 'High',
      source: 'Metadata declaration',
      summary: 'AI creation metadata was found.',
      observations: (metadata.findings || []).map((f) => f.message),
      limitation:
        'This confidence describes the metadata evidence, not a calibrated probability. Metadata can be changed; signatures were not verified.',
    };
  if (codes.includes('ai-tool'))
    return {
      label: 'AI-generated or edited',
      confidence: 'Medium',
      source: 'Metadata',
      summary: 'The file names an AI creation tool.',
      observations: metadata.findings.map((f) => f.message),
      limitation:
        'A tool name does not prove that the entire image was generated. Metadata is unverified.',
    };
  if (visual?.status === 'completed' && visual.origin) {
    const cues = visual.origin.label === 'AI-like visual cues';
    return {
      label: cues
        ? 'Likely AI-generated'
        : visual.origin.label === 'No clear AI cues'
          ? 'No clear AI signs'
          : 'Origin unclear',
      confidence: cues ? 'Medium' : 'Low',
      source: 'AI visual review',
      summary: visual.origin.summary,
      observations: visual.origin.observations,
      limitation:
        'Visual review is not a forensic detector or a calibrated probability. Screenshots, edits and new generators can fool it.',
    };
  }
  return {
    label: 'Origin check unavailable',
    confidence: 'Not measured',
    source: 'Metadata only',
    summary: visual?.message || 'No explicit AI creation marker was found.',
    observations: [],
    limitation:
      'Missing metadata does not establish that the image is authentic. Screenshots can remove it.',
  };
}

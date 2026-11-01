export async function generateStructured({
  config,
  env,
  instruction,
  input,
  schema,
  name = 'message_safety',
  image,
  fetcher = fetch,
}) {
  const openrouter = config.providerId === 'openrouter';
  const payload = openrouter
    ? {
        model: config.model,
        messages: [
          { role: 'system', content: instruction },
          {
            role: 'user',
            content: image
              ? [
                  { type: 'text', text: input },
                  { type: 'image_url', image_url: { url: image, detail: 'auto' } },
                ]
              : input,
          },
        ],
        response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
        max_tokens: 3072,
        reasoning: { effort: 'minimal', exclude: true },
        provider: {
          require_parameters: true,
          sort: 'latency',
          max_price: { prompt: 0, completion: 0, request: 0, image: 0 },
        },
      }
    : {
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [
          {
            role: 'user',
            parts: [
              { text: input },
              ...(image
                ? [{ inlineData: { mimeType: 'image/jpeg', data: image.split(',')[1] } }]
                : []),
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          maxOutputTokens: 3072,
          ...(/^gemini-[34](?:[.-]|$)/.test(config.model)
            ? { thinkingConfig: { thinkingLevel: 'low' } }
            : {}),
        },
      };
  const response = await fetcher(
    openrouter
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://generativelanguage.googleapis.com/v1beta/models/' +
          config.model +
          ':generateContent',
    {
      method: 'POST',
      headers: openrouter
        ? {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + env.OPENROUTER_API_KEY.trim(),
          }
        : { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY.trim() },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    },
  );
  if (!response.ok) return { ok: false, http: response.status };
  const data = await response.json(),
    candidate = openrouter ? data.choices?.[0] : data.candidates?.[0];
  if (
    data.error ||
    data.promptFeedback?.blockReason ||
    (openrouter
      ? candidate?.finish_reason !== 'stop' || candidate?.message?.refusal
      : candidate?.finishReason !== 'STOP')
  )
    return { ok: false, http: 502, incomplete: true };
  const content = openrouter
    ? candidate.message?.content
    : (candidate.content?.parts || [])
        .filter((p) => !p.thought && typeof p.text === 'string')
        .map((p) => p.text)
        .join('');
  return {
    ok: true,
    value: JSON.parse(content),
    model: openrouter && typeof data.model === 'string' ? data.model : config.model,
  };
}

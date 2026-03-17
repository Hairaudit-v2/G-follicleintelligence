/**
 * Renders JSON-LD structured data in a script tag.
 * Use with schema objects from lib/structured-data or custom schema.
 */
interface JsonLdProps {
  /** Single schema object or array of schemas (e.g. from getRootStructuredData). */
  data: object | object[];
}

export function JsonLd({ data }: JsonLdProps) {
  const payload = Array.isArray(data) ? data : [data];
  const __html = JSON.stringify(payload.length === 1 ? payload[0] : payload);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html }}
    />
  );
}

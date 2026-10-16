/**
 * schema.org structured data as a <script type="application/ld+json">.
 * A server component: the JSON is in the static HTML, never in a client
 * bundle. JSON-LD is data, not markup — "<" is escaped so no text in it
 * (a title, a story) can close the script tag or open a comment.
 */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

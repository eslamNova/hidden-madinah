/**
 * Calligraphic callout for a place's آية/حديث — elevated surface card with a
 * soft gold border and hairline, Amiri type. (Was sand-on-sand and vanished
 * into the page background.)
 */
export function FeaturedQuote({
  quote,
  source,
}: {
  quote: string;
  source: string | null;
}) {
  return (
    <figure className="card-elevated border-accent/50 p-6 text-center sm:p-8">
      <blockquote className="font-wordmark text-2xl leading-loose text-primary-dark">
        {quote}
      </blockquote>
      <span aria-hidden="true" className="gold-rule mx-auto mt-4 block h-px w-24" />
      {source && (
        <figcaption className="mt-3 text-base text-muted">{source}</figcaption>
      )}
    </figure>
  );
}
/**
 * Calligraphic callout for a place's آية/حديث — sand background, thin gold
 * border, Amiri type, per Content Pack UI spec.
 */
export function FeaturedQuote({
  quote,
  source,
}: {
  quote: string;
  source: string | null;
}) {
  return (
    <figure className="rounded-2xl border border-accent bg-sand p-6 text-center">
      <blockquote className="font-wordmark text-2xl leading-loose text-primary-dark">
        {quote}
      </blockquote>
      {source && (
        <figcaption className="mt-3 text-base text-muted">{source}</figcaption>
      )}
    </figure>
  );
}
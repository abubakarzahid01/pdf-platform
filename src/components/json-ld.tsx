// Structured data (schema.org) that tells search engines what a page is: the site, a web
// app, its questions and answers. "<" is escaped so the text can't close the script tag.
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

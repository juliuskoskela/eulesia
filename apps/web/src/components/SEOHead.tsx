import { Helmet } from "react-helmet-async";

const SITE_NAME = "Eulesia";
const SITE_URL = "https://eulesia.org";
const DEFAULT_DESCRIPTION = "Eurooppalainen kansalaisdemokratia-alusta";
const DEFAULT_IMAGE = `${SITE_URL}/og-default.png`;

interface SEOHeadProps {
  title: string;
  description?: string;
  path: string;
  type?: string;
  image?: string;
  jsonLd?: Record<string, unknown>;
  noIndex?: boolean;
}

export function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  type = "website",
  image,
  jsonLd,
  noIndex = false,
}: SEOHeadProps) {
  const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = `${SITE_URL}${path}`;
  const desc =
    description.length > 160
      ? description.substring(0, 157) + "..."
      : description;
  const imageUrl = image
    ? image.startsWith("http")
      ? image
      : `${SITE_URL}${image}`
    : DEFAULT_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" hrefLang="fi" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />

      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={imageUrl} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={imageUrl} />

      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}

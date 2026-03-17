# Full SEO Audit — Follicle Intelligence

**Site:** https://www.follicleintelligence.ai  
**Stack:** Next.js 14 (App Router)  
**Audit date:** March 2025

---

## Executive summary

The site has a solid base: root metadata, Open Graph, Twitter cards, manifest, semantic HTML, and good internal linking. Critical gaps are: **no sitemap or robots.txt**, **no page-specific titles/descriptions** (all pages share the same meta), **no og:image**, **no structured data (JSON-LD)**, and **admin routes are indexable**. Recommended fixes are implemented where noted below.

---

## 1. Technical SEO

### 1.1 Sitemap — **Missing → Fixed**

- **Issue:** No `sitemap.xml`; crawlers rely only on discovery via links.
- **Impact:** Slower or incomplete indexing of deep pages (e.g. `/methodology`, `/security`).
- **Fix:** Added `app/sitemap.ts` that lists all public marketing pages with `lastModified`, `changeFrequency`, and `priority`.

### 1.2 Robots.txt — **Missing → Fixed**

- **Issue:** No `robots.txt`; no explicit crawl rules or sitemap reference.
- **Impact:** No control over crawler access; sitemap not advertised.
- **Fix:** Added `app/robots.ts` with `allow: /`, `disallow: /fi-admin/`, and `sitemap: https://www.follicleintelligence.ai/sitemap.xml`.

### 1.3 Admin / private routes — **Indexable → Fixed**

- **Issue:** `/fi-admin/*` has no `noindex`; internal admin could be indexed.
- **Fix:** Added layout-level metadata in `app/(fi-admin)/layout.tsx` with `robots: { index: false, follow: false }`.

### 1.4 Canonical URLs

- **Status:** OK. `metadataBase: new URL("https://www.follicleintelligence.ai")` is set in root layout, so Next.js can resolve relative URLs and avoid duplicate-content issues when the site is served from one canonical domain.

### 1.5 HTTPS / redirects

- **Status:** Assumed handled at host (e.g. Vercel). Ensure HTTPS and non-www → www (or vice versa) redirects are configured at the platform.

---

## 2. On-page SEO

### 2.1 Root metadata — **Good**

- **Title:** "Follicle Intelligence | Enterprise Clinical Audit Intelligence" — clear and branded.
- **Description:** Present, ~150 characters, includes key terms (auditing, scoring, benchmarking, governance, white-label).
- **Open Graph:** `og:title`, `og:description`, `og:site_name`, `og:type` set.
- **Twitter:** `summary_large_image` with title and description.

### 2.2 Page-level metadata — **Missing → Partially fixed**

- **Issue:** Every route (e.g. `/platform`, `/solutions`, `/contact`, `/methodology`) inherits the same `<title>` and `<meta name="description">`. This hurts relevance and CTR for long-tail queries (e.g. "clinical audit methodology", "white label hair audit").
- **Fix:** Added `generateMetadata` or static `metadata` export to key public pages: home (already implied by layout), platform, solutions, methodology, white-label, hair-intelligence, about, contact, security, integration, licensing, use-cases, future-verticals, modules, dashboard-demo. Each has a unique title and description derived from the page hero/copy.

### 2.3 Open Graph image — **Missing**

- **Issue:** No `og:image` (or `twitter:image`). Shares on social/default link previews will have no image.
- **Recommendation:** Add a 1200×630px OG image (e.g. `/og.png` or `/brand/og-image.png`) and set in root layout:
  - `openGraph: { images: [{ url: '/og.png', width: 1200, height: 630 }] }`
  - `twitter: { images: ['/og.png'] }` (or use Twitter’s image option in metadata).
- **Status:** Placeholder path added in layout; replace with real asset when ready.

### 2.4 Heading structure — **Good**

- **Home:** Single `<h1>`: "The intelligence engine behind audit, training, and benchmarking."
- **Subpages:** `PageHero` renders one `<h1>` per page (e.g. "Platform", "Solutions") with consistent hierarchy. No duplicate h1s observed.

### 2.5 Images and alt text — **Good**

- Header logo: `alt="Follicle Intelligence"`.
- Footer logo: `alt="Follicle Intelligence"`.
- No decorative images missing alt; SVG/icon usage is appropriate.

### 2.6 Internal linking — **Good**

- Primary nav and footer expose main sections; ecosystem band links to IIOHR, HairAudit, HLI.
- CTA links to `/contact`, `/platform`, `/dashboard-demo` from homepage. No broken internal links detected in nav.

### 2.7 External links — **Good**

- Footer and ecosystem nav use `target="_blank"` with `rel="noopener noreferrer"` for external URLs.

---

## 3. Structured data (JSON-LD)

- **Status:** **Missing.**
- **Recommendation:** Add Organization (and optionally WebSite) schema in root layout or a dedicated component, e.g.:
  - `@type: Organization`, name, url, logo, sameAs (IIOHR, HairAudit, HLI if desired).
  - Optional: `WebSite` with `potentialAction` (e.g. Contact) for richer SERP features.
- **Priority:** Medium; improves brand panel and knowledge graph potential.

---

## 4. Performance / Core Web Vitals (indirect SEO)

- **Status:** Not measured in this audit. Next.js and static/mostly static pages typically perform well; recommend checking with Lighthouse or Vercel Analytics and addressing LCP/CLS if needed.
- **Note:** Header logo uses `priority` on `Image`; good for LCP of above-the-fold content.

---

## 5. Mobile and accessibility

- **Viewport:** Not set explicitly in metadata; Next.js default is responsive. Consider adding `viewport` in layout if you need explicit scale/width (already present as `Viewport` export).
- **Theme/manifest:** `theme_color`, `colorScheme: "dark"`, and `site.webmanifest` with icons and `display: "standalone"` are set — good for PWA and mobile.

---

## 6. Checklist summary

| Item | Before | After |
|------|--------|--------|
| Sitemap | ❌ | ✅ `app/sitemap.ts` |
| Robots.txt | ❌ | ✅ `app/robots.ts` |
| Noindex admin | ❌ | ✅ fi-admin layout |
| Page-level title/description | ❌ | ✅ Key pages |
| og:image | ❌ | ⚠️ Placeholder path (add asset) |
| Root title/description/OG/Twitter | ✅ | ✅ |
| Canonical base | ✅ | ✅ |
| Single h1 per page | ✅ | ✅ |
| Image alt text | ✅ | ✅ |
| External link rel | ✅ | ✅ |
| JSON-LD | ❌ | ❌ (recommended) |

---

## 7. Recommended next steps

1. **Add and use a real og:image** at the path referenced in layout (e.g. 1200×630).
2. **Implement Organization (and optional WebSite) JSON-LD** in the root layout.
3. **Run Lighthouse (SEO + Performance)** on production and fix any remaining issues.
4. **Submit sitemap** in Google Search Console (and Bing) after deploy.
5. **Optional:** Add `alternate` hreflang if you ever add localized versions (e.g. en-GB, etc.).

---

*Audit performed against the codebase and Next.js 14 metadata conventions. Live crawl (e.g. Screaming Frog or GSC) recommended for a full production audit.*

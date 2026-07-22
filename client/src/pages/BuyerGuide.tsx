import { useEffect, useMemo } from "react";
import { setSEO } from "@/lib/seo";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, BookOpen, ChevronRight, Clock, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { SeoArticle } from "@/lib/types";
import { parseJsonField } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { breadcrumbSchema } from "@/lib/seo";

// ── Helpers ────────────────────────────────────────────────────────────────────

function readingTime(body?: string | null): string {
  if (!body) return "1 min read";
  const words = body.trim().split(/\s+/).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} min read`;
}

function formatDate(raw?: string | null): string {
  if (!raw) return "2026";
  try {
    return new Date(raw).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return "2026";
  }
}

// Render inline markdown: **bold** and [text](url)
function renderInline(text: string): (string | JSX.Element)[] {
  // Split on **bold** and [text](url) patterns
  const parts = text.split(/(\*\*.*?\*\*|\[.*?\]\(.*?\))/g);
  return parts.map((part, pi) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={pi} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/);
    if (linkMatch) {
      return (
        <a key={pi} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="text-green-700 underline underline-offset-2 hover:text-green-900 transition-colors">
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}

// Render markdown body: ## h2, ### h3, | tables, - lists, paragraphs
function renderBody(body: string): JSX.Element[] {
  const lines = body.split("\n");
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="text-xl font-bold mt-10 mb-3 text-foreground border-b border-border pb-2">
          {line.slice(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="text-base font-semibold mt-6 mb-2 text-foreground">
          {line.slice(4)}
        </h3>
      );
    } else if (line.startsWith("| ")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const [header, , ...rows] = tableLines;
      const headers = header.split("|").filter(Boolean).map(h => h.trim());
      elements.push(
        <div key={i} className="overflow-x-auto my-5 rounded-lg border border-border shadow-sm">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-border">
                {headers.map((h, j) => (
                  <th key={j} className="px-4 py-3 text-left font-semibold text-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                  {row.split("|").filter(Boolean).map((cell, ci) => (
                    <td key={ci} className="px-4 py-3 text-muted-foreground">{renderInline(cell.trim())}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    } else if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={i} className="my-4 space-y-2 pl-1">
          {items.map((item, j) => (
            <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
              <span>{renderInline(item)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    } else if (line.trim() !== "") {
      elements.push(
        <p key={i} className="text-sm text-muted-foreground leading-relaxed my-3">
          {renderInline(line)}
        </p>
      );
    }

    i++;
  }
  return elements;
}

// ── Related articles relevance map (module-level, no runtime cost) ───────────
const RELATED_MAP: Record<string, string[]> = {
  'how-much-does-a-golf-cart-cost-in-florida': ['used-golf-cart-cost-florida', 'best-golf-cart-brands-florida-georgia', 'new-vs-used-golf-cart'],
  'used-golf-cart-cost-florida': ['lithium-vs-lead-acid-golf-cart-battery', 'street-legal-golf-cart-florida', 'golf-cart-dealer-vs-private-seller'],
  'lithium-vs-lead-acid-golf-cart-battery': ['used-golf-cart-cost-florida', 'best-golf-cart-brands-florida-georgia', 'golf-cart-warranty-what-to-know'],
  'best-golf-cart-brands-florida-georgia': ['used-golf-cart-cost-florida', 'new-vs-used-golf-cart', 'lithium-vs-lead-acid-golf-cart-battery'],
  'new-vs-used-golf-cart': ['used-golf-cart-cost-florida', 'golf-cart-dealer-vs-private-seller', 'golf-cart-warranty-what-to-know'],
  'street-legal-golf-cart-florida': ['golf-cart-communities-florida', 'used-golf-cart-cost-florida', 'best-golf-cart-brands-florida-georgia'],
  'golf-cart-dealer-vs-private-seller': ['used-golf-cart-cost-florida', 'new-vs-used-golf-cart', 'golf-cart-delivery-florida'],
  'how-to-check-golf-cart-deal': ['used-golf-cart-cost-florida', 'new-vs-used-golf-cart', 'golf-cart-dealer-vs-private-seller'],
  'golf-cart-warranty-what-to-know': ['used-golf-cart-cost-florida', 'new-vs-used-golf-cart', 'best-golf-cart-brands-florida-georgia'],
  'golf-cart-delivery-florida': ['used-golf-cart-cost-florida', 'golf-cart-dealer-vs-private-seller', 'golf-cart-communities-florida'],
  'golf-cart-communities-florida': ['street-legal-golf-cart-florida', 'used-golf-cart-cost-florida', 'how-to-check-golf-cart-deal'],
};

// ── Buyer Guide Index ──────────────────────────────────────────────────────────
export function BuyerGuideIndex() {
  useEffect(() => {
    setSEO({
      title: "Golf Cart Buyer Guide | GolfCartIQ",
      description: "Everything you need to know before buying a golf cart in Florida or Georgia — battery types, brands, pricing, street legal rules, and dealer vs. private seller.",
      canonical: "https://golfcartiq.com/buyer-guide",
    });
  }, []);

  const { data: articles = [], isLoading } = useQuery<SeoArticle[]>({
    queryKey: ["/api/buyer-guide"],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <span>Written by the GolfCartIQ team · Florida &amp; Georgia golf cart market data</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Golf Cart Buyer Guide</h1>
          <p className="text-muted-foreground mt-2 text-sm max-w-xl">
            Everything you need to know before buying a golf cart in Florida or Georgia.{" "}
            <Link href="/deal-checker" className="text-green-700 hover:underline font-medium">Check any deal free →</Link>
          </p>
        </div>

        {/* Articles grid */}
        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3,4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {articles.map((article) => (
              <Link
                key={article.id}
                href={`/buyer-guide/${article.slug}`}
                className="block p-5 rounded-xl border border-border bg-white hover:shadow-md hover:border-green-200 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <BookOpen className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm leading-snug mb-1.5 group-hover:text-green-700 transition-colors">
                      {article.title}
                    </h2>
                    {article.shortAnswer && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {article.shortAnswer}
                      </p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/60">
                      <Clock className="h-3 w-3" />
                      {readingTime(article.body)}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-green-600 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* CTA block */}
        <div className="mt-10 bg-foreground text-background rounded-xl p-6 text-center">
          <h2 className="font-bold text-lg mb-2">Ready to check a deal?</h2>
          <p className="text-sm opacity-80 mb-4">
            Found a cart on Facebook, Craigslist, or a dealer site? Get your free GolfCartIQ analysis in seconds.
          </p>
          <Link href="/deal-checker">
            <Button variant="secondary" size="lg">Check a Deal Free</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Article Detail ─────────────────────────────────────────────────────────────
export function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();

  const { data: article, isLoading, isError } = useQuery<SeoArticle>({
    queryKey: ["/api/buyer-guide", slug],
    queryFn: () => apiRequest("GET", `/api/buyer-guide/${slug}`).then((r) => r.json()),
    enabled: !!slug,
    retry: false,
  });

  // Fetch all articles for related cross-links — reuse the index cache
  const { data: allArticles = [] } = useQuery<SeoArticle[]>({
    queryKey: ["/api/buyer-guide"],
  });

  // Derive related articles from RELATED_MAP (computed, no extra fetch)
  const relatedArticles = useMemo(() => {
    if (!article?.slug) return [];
    const relatedSlugs = RELATED_MAP[article.slug] ?? [];
    return relatedSlugs
      .map((s) => allArticles.find((a) => a.slug === s))
      .filter((a): a is SeoArticle => !!a)
      .slice(0, 3);
  }, [article?.slug, allArticles]);

  // ALL hooks must run before any conditional returns
  const faqs = useMemo(
    () => parseJsonField<{ q: string; a: string }>(article?.faqJson),
    [article?.faqJson]
  );

  useEffect(() => {
    if (!article) return;
    const BASE = "https://golfcartiq.com";
    const canonicalUrl = `${BASE}${article.canonicalPath || `/buyer-guide/${article.slug}`}`;
    const faqData = parseJsonField<{ q: string; a: string }>(article.faqJson);

    const articleSchema = {
      "@type": "Article",
      "@id": canonicalUrl,
      "headline": article.h1 || article.title,
      "description": article.metaDescription || article.shortAnswer,
      "url": canonicalUrl,
      "datePublished": article.createdAt,
      "dateModified": article.updatedAt || article.createdAt,
      "author": { "@type": "Organization", "name": "GolfCartIQ", "url": BASE },
      "publisher": { "@type": "Organization", "name": "GolfCartIQ", "url": BASE },
      "mainEntityOfPage": canonicalUrl,
      "inLanguage": "en-US",
      "keywords": [
        article.primaryKeyword,
        ...parseJsonField<string>(typeof article.secondaryKeywords === "string" ? article.secondaryKeywords : undefined),
      ].filter(Boolean).join(", "),
    };

    const faqSchema = faqData.length > 0 ? {
      "@type": "FAQPage",
      "mainEntity": faqData.map(faq => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": { "@type": "Answer", "text": faq.a },
      })),
    } : null;

    const crumbs = breadcrumbSchema([
      { name: "GolfCartIQ", url: BASE },
      { name: "Buyer Guide", url: `${BASE}/buyer-guide` },
      { name: article.title, url: canonicalUrl },
    ]);

    setSEO({
      title: `${article.title} — Buyer Guide`,
      description: article.metaDescription || article.shortAnswer || undefined,
      canonical: canonicalUrl,
      jsonLd: [articleSchema, ...(faqSchema ? [faqSchema] : []), crumbs],
    });
  }, [article]);

  // ── Render states ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted-foreground">
        <p className="text-lg font-medium mb-2">Article not found</p>
        <p className="text-sm mb-6">This guide may have moved. Browse all buyer guides below.</p>
        <Link href="/buyer-guide"><Button variant="outline">Back to Buyer Guide</Button></Link>
      </div>
    );
  }

  const minutes = readingTime(article.body);
  const publishDate = formatDate(article.updatedAt || article.createdAt);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-foreground transition-colors">GolfCartIQ</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/buyer-guide" className="hover:text-foreground transition-colors">Buyer Guide</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium truncate">{article.title}</span>
        </nav>

        {/* Article header */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold leading-tight mb-4 text-foreground">
            {article.h1 || article.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mb-5">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              GolfCartIQ Research Team
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {minutes}
            </span>
            <span>Updated {publishDate}</span>
            <span className="text-green-700 font-medium">Florida &amp; Georgia</span>
          </div>

          {/* Quick answer box */}
          {article.shortAnswer && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-900 leading-relaxed">
              <p className="font-semibold mb-1 text-green-800">Quick Answer</p>
              {article.shortAnswer}
            </div>
          )}
        </header>

        {/* Body */}
        <article className="article-body">
          {article.body && renderBody(article.body)}
        </article>

        {/* FAQ section — structured for Google FAQ rich result */}
        {faqs.length > 0 && (
          <section className="mt-12" aria-label="Frequently Asked Questions">
            <h2 className="text-xl font-bold mb-6 text-foreground">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border border-border rounded-xl p-5 bg-white">
                  <h3 className="font-semibold text-sm mb-2 text-foreground">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Internal CTA */}
        <div className="mt-12 bg-foreground text-background rounded-xl p-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <p className="font-bold text-base mb-1">Check any golf cart deal — free</p>
            <p className="text-sm opacity-75">
              GolfCartIQ compares your cart against 1,300+ FL/GA listings. Get a GolfCartIQ Deal Rating and fair market value in seconds.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Link href="/deal-checker"><Button variant="secondary" size="sm">Check a Deal</Button></Link>
            <Link href="/search"><Button size="sm" className="bg-white/10 hover:bg-white/20 text-background border border-white/20">Search Carts</Button></Link>
          </div>
        </div>

        {/* Related Articles */}
        {relatedArticles.length > 0 && (
          <section className="mt-12" aria-label="Related articles">
            <h2 className="text-lg font-bold mb-4 text-foreground">Related Articles</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {relatedArticles.map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/buyer-guide/${rel.slug}`}
                  className="block p-4 rounded-xl border border-border bg-white hover:shadow-md hover:border-green-200 transition-all group"
                >
                  <div className="flex items-start gap-2">
                    <BookOpen className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm leading-snug mb-1 group-hover:text-green-700 transition-colors line-clamp-2">
                        {rel.title}
                      </p>
                      {rel.metaDescription && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {rel.metaDescription.length > 100
                            ? rel.metaDescription.slice(0, 97) + "..."
                            : rel.metaDescription}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Back link */}
        <div className="mt-8 pt-6 border-t border-border">
          <Link href="/buyer-guide" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Buyer Guide
          </Link>
          <p className="text-xs text-muted-foreground mt-2">
            Last updated: {publishDate} · GolfCartIQ covers 50+ FL/GA golf cart dealers.
          </p>
        </div>

      </div>
    </div>
  );
}

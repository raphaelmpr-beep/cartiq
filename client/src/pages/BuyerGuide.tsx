import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, BookOpen, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { SeoArticle } from "@/lib/types";
import { parseJsonField } from "@/lib/utils";

// ── Buyer Guide Index ──────────────────────────────────────────────────────────
export function BuyerGuideIndex() {
  const { data: articles = [], isLoading } = useQuery<SeoArticle[]>({
    queryKey: ["/api/buyer-guide"],
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Golf Cart Buyer Guide</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Everything you need to know before buying a golf cart in Florida or Georgia.
            <Link href="/deal-checker"><a className="text-green-700 hover:underline ml-1">Check any deal →</a></Link>
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3,4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {articles.map((article) => (
              <Link key={article.id} href={`/buyer-guide/${article.slug}`}>
                <a className="block p-5 rounded-xl border border-border bg-white hover:shadow-md transition-all group">
                  <div className="flex items-start gap-3">
                    <BookOpen className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-sm leading-snug mb-1.5 group-hover:text-green-700 transition-colors">{article.title}</h2>
                      {article.shortAnswer && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{article.shortAnswer}</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-10 bg-foreground text-background rounded-xl p-6 text-center">
          <h2 className="font-bold text-lg mb-2">Ready to check a deal?</h2>
          <p className="text-sm opacity-80 mb-4">Find a cart anywhere. Enter the details. Get your private CartIQ analysis in seconds.</p>
          <Link href="/deal-checker"><a><Button variant="secondary" size="lg">Check a Deal</Button></a></Link>
        </div>
      </div>
    </div>
  );
}

// ── Article Detail ─────────────────────────────────────────────────────────────
export function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();

  const { data: article, isLoading } = useQuery<SeoArticle>({
    queryKey: ["/api/buyer-guide", slug],
    queryFn: () => fetch(`/api/buyer-guide/${slug}`).then((r) => {
      if (!r.ok) throw new Error("Not found");
      return r.json();
    }),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center text-muted-foreground">
        <p className="text-lg font-medium mb-2">Article not found</p>
        <Link href="/buyer-guide"><a><Button variant="outline">Back to Guide</Button></a></Link>
      </div>
    );
  }

  const faqs = parseJsonField<{ q: string; a: string }>(article.faqJson);

  // Render simple markdown-ish body (bold, headers, paragraphs, lists, tables)
  function renderBody(body: string) {
    const lines = body.split("\n");
    const elements: JSX.Element[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith("## ")) {
        elements.push(<h2 key={i} className="text-lg font-bold mt-8 mb-3 text-foreground">{line.slice(3)}</h2>);
      } else if (line.startsWith("### ")) {
        elements.push(<h3 key={i} className="text-base font-semibold mt-6 mb-2 text-foreground">{line.slice(4)}</h3>);
      } else if (line.startsWith("| ")) {
        // Table
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].startsWith("|")) {
          tableLines.push(lines[i]);
          i++;
        }
        const [header, , ...rows] = tableLines;
        const headers = header.split("|").filter(Boolean).map(h => h.trim());
        elements.push(
          <div key={i} className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse border border-border rounded">
              <thead>
                <tr className="bg-muted">
                  {headers.map((h, j) => <th key={j} className="p-2 text-left border border-border font-semibold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} className="odd:bg-white even:bg-gray-50">
                    {row.split("|").filter(Boolean).map((cell, ci) => (
                      <td key={ci} className="p-2 border border-border">{cell.trim()}</td>
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
          <ul key={i} className="list-disc pl-5 space-y-1 my-3">
            {items.map((item, j) => <li key={j} className="text-sm text-muted-foreground">{item}</li>)}
          </ul>
        );
        continue;
      } else if (line.trim() !== "") {
        // Parse **bold**
        // Safe bold rendering: split on **text** without injecting raw HTML
        const parts = line.split(/\*\*(.*?)\*\*/g);
        const rendered = parts.map((part, pi) =>
          pi % 2 === 1 ? <strong key={pi}>{part}</strong> : part
        );
        elements.push(<p key={i} className="text-sm text-muted-foreground leading-relaxed my-2">{rendered}</p>);
      }

      i++;
    }
    return elements;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/buyer-guide">
          <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Buyer Guide
          </a>
        </Link>

        {/* Article header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold leading-tight mb-3">{article.h1 || article.title}</h1>
          {article.shortAnswer && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-900 leading-relaxed">
              <strong>Quick Answer:</strong> {article.shortAnswer}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="prose-like">
          {article.body && renderBody(article.body)}
        </div>

        {/* FAQ section */}
        {faqs.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-sm mb-2">{faq.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Internal CTA */}
        <div className="mt-10 bg-gray-50 border border-border rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold text-sm">Check a deal using CartIQ</p>
            <p className="text-xs text-muted-foreground mt-1">Use the Deal Checker to analyze any cart from Facebook, Craigslist, a dealer, or Costco.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/deal-checker"><a><Button size="sm">Check a Deal</Button></a></Link>
            <Link href="/search"><a><Button size="sm" variant="outline">Search Carts</Button></a></Link>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-6">Last updated: {new Date(article.updatedAt).toLocaleDateString()}</p>
      </div>
    </div>
  );
}

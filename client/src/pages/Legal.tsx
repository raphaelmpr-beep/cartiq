import { useEffect } from "react";
import { setSEO } from "@/lib/seo";
import { Link } from "wouter";
import { ShieldCheck, ExternalLink, BookOpen, AlertCircle, Mail, Scale } from "lucide-react";

const LAST_UPDATED = "June 23, 2026";

interface SectionProps {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ id, icon, title, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <span className="text-green-600">{icon}</span>
        <h2 className="text-lg font-bold text-foreground">{title}</h2>
      </div>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="leading-relaxed">{children}</p>;
}

function Ul({ items }: { items: (string | React.ReactNode)[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function GreenBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
      <p className="font-semibold text-green-800 mb-1 text-sm">{label}</p>
      <p className="text-sm text-green-900 leading-relaxed">{children}</p>
    </div>
  );
}

export default function Disclosure() {
  useEffect(() => {
    setSEO({
      title: "Information Disclosure | CartIQ",
      description:
        "How CartIQ sources, displays, and links publicly available golf cart listings from licensed dealers across Florida and Georgia. Includes pricing, data use, and contact information.",
      canonical: "https://cartiq-chi.vercel.app/disclosure",
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Page header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <span>Last updated: {LAST_UPDATED}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-2">Information Disclosure</h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            CartIQ is a price intelligence and comparison platform for the Florida and Georgia golf cart market.
            This page explains where our listings come from, how we use publicly available data, and what our
            pricing tools do — and don't — represent.
          </p>

          {/* Section jump nav */}
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Page sections">
            {[
              { id: "where-listings-come-from", label: "Where Listings Come From" },
              { id: "how-we-display-them",      label: "How We Display Them" },
              { id: "pricing-tools",            label: "Pricing Tools" },
              { id: "data-we-dont-use",         label: "Data We Don't Use" },
              { id: "copyright-and-factual-data", label: "Copyright & Factual Data" },
              { id: "removal-requests",          label: "Removal Requests" },
              { id: "contact",                   label: "Contact" },
            ].map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex items-center px-3 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-green-200 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* Sections */}
        <div className="space-y-12">

          {/* 1 — Where listings come from */}
          <Section
            id="where-listings-come-from"
            icon={<ExternalLink className="h-5 w-5" />}
            title="Where Our Listings Come From"
          >
            <P>
              Every listing on CartIQ originates from a source that has made the inventory publicly available for
              consumer discovery. CartIQ does not manufacture, sell, or broker any vehicle. We are a research and
              comparison tool — nothing more.
            </P>
            <P>Listings on CartIQ come from three sources:</P>
            <Ul items={[
              "Licensed golf cart dealerships that have published their inventory on their own public-facing websites.",
              "Authorized retail portals and manufacturer distribution channels where inventory is posted for consumer browsing.",
              "Sellers who have explicitly submitted their own listing to CartIQ for publication.",
            ]} />
            <GreenBox label="We link back to the source">
              Every listing card shows the originating dealer name and links directly to the dealer's website or
              original listing page where available. CartIQ is a starting point for research — buyers transact
              directly with the seller.
            </GreenBox>
          </Section>

          {/* 2 — How we display them */}
          <Section
            id="how-we-display-them"
            icon={<BookOpen className="h-5 w-5" />}
            title="How We Display Listings"
          >
            <P>
              CartIQ displays listing information as provided by the dealer or source. We may normalize formatting
              for consistency — for example, standardizing model name capitalization or condition labels — but we
              do not alter prices, availability status, or vehicle descriptions.
            </P>
            <Ul items={[
              "Prices shown are as listed by the dealer at the time of indexing. They may not reflect real-time availability.",
              "Condition labels (New / Used) are sourced from the dealer's own classification.",
              "Listing images are sourced directly from the dealer's listing and displayed as-is.",
              "CartIQ attributes every listing to its source dealer. We do not present third-party inventory as CartIQ's own.",
            ]} />
            <P>
              Listings may be periodically re-checked for accuracy, but CartIQ does not guarantee that any listing
              reflects current stock or pricing at the time you view it. Always confirm details directly with the dealer.
            </P>
          </Section>

          {/* 3 — Pricing tools */}
          <Section
            id="pricing-tools"
            icon={<AlertCircle className="h-5 w-5" />}
            title="Our Pricing Tools — What They Are and Aren't"
          >
            <P>
              CartIQ's deal rating, CartIQ Value, and delivery-adjusted pricing tools are analytical features built
              on aggregated market data from listings across Florida and Georgia. They are designed to help buyers
              make more informed comparisons — not to serve as professional appraisals or binding price quotes.
            </P>
            <Ul items={[
              <>
                <strong className="font-medium text-foreground">CartIQ Value</strong> is an estimate of fair market value based on comparable listings in our database. It is not a certified appraisal.
              </>,
              <>
                <strong className="font-medium text-foreground">Deal Rating</strong> (Great Deal, Fair Price, High Price, etc.) reflects how a listing's asking price compares to similar carts in our index at that moment.
              </>,
              <>
                <strong className="font-medium text-foreground">Delivery estimate</strong> is an approximation based on distance. Actual delivery charges are set by the dealer and may differ.
              </>,
            ]} />
            <P>
              CartIQ is not a licensed vehicle dealer, broker, or financial advisor. Nothing on this platform
              constitutes an offer to sell, a binding price commitment, or financial or legal advice. All purchase
              decisions are made solely between the buyer and seller.
            </P>
          </Section>

          {/* 4 — Data we don't use */}
          <Section
            id="data-we-dont-use"
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Data We Don't Use"
          >
            <P>
              CartIQ is deliberate about what data it does not collect or display:
            </P>
            <Ul items={[
              "We do not index or display Facebook Marketplace listings. CartIQ does not access, reproduce, or redistribute content from Facebook or any Meta platform.",
              "We do not index listings that require a login, account, or subscription to view.",
              "We do not collect personal data from sellers or buyers beyond what is voluntarily submitted through our own platform (e.g., saved searches or submitted listings).",
              "We do not sell, share, or redistribute raw listing data to third parties.",
            ]} />
            <GreenBox label="No Facebook. No exceptions.">
              CartIQ's scope is licensed dealer inventory and seller-submitted listings. We do not use any
              automated methods to access consumer-to-consumer marketplace platforms.
            </GreenBox>
          </Section>

          {/* 5 — Copyright & Factual Data */}
          <Section
            id="copyright-and-factual-data"
            icon={<Scale className="h-5 w-5" />}
            title="Copyright, Factual Data & Our Legal Basis"
          >
            <P>
              Some dealer websites display broad copyright notices — for example, claiming that "content,
              including images, displayed on this website is protected by copyright laws" and that
              "downloading, republication, retransmission or reproduction" is prohibited.
              CartIQ takes these notices seriously, and we operate well within the boundaries of
              U.S. copyright law.
            </P>

            <GreenBox label="Facts are not copyrightable — U.S. Supreme Court">
              In <em>Feist Publications, Inc. v. Rural Telephone Service Co.</em> (1991), the U.S. Supreme
              Court held that facts — regardless of the effort required to compile them — are not protectable
              by copyright. Copyright protects original creative expression, not facts, ideas, systems, or
              methods of operation. The U.S. Copyright Office affirms this principle.
            </GreenBox>

            <P>
              The information CartIQ indexes — cart brand, model, year, condition, asking price, and dealer
              name — is factual data. These are not creative works. A dealer listing that states
              "2024 Club Car Onward, 4-passenger, $11,995" conveys facts. Copyright does not
              protect the underlying facts, only an author's original creative expression of those facts.
            </P>

            <P>
              The relevant legal standards that define CartIQ's operating basis:
            </P>
            <Ul items={[
              <>
                <strong className="font-medium text-foreground">Feist v. Rural (1991)</strong> — The "sweat of the brow" doctrine does not create copyright in factual compilations. Facts remain in the public domain regardless of the effort required to gather them.
              </>,
              <>
                <strong className="font-medium text-foreground">17 U.S.C. § 102(b)</strong> — U.S. copyright law explicitly excludes protection for "any idea, procedure, process, system, method of operation, concept, principle, or discovery" — which encompasses publicly listed pricing and specifications.
              </>,
              <>
                <strong className="font-medium text-foreground">Thin copyright in compilations</strong> — A dealer's compiled product database may receive "thin" copyright protection only over original creative selection or arrangement — not the underlying facts. Accessing and displaying the individual facts is not infringement.
              </>,
              <>
                <strong className="font-medium text-foreground">Images displayed from source</strong> — CartIQ does not download, host, or reproduce dealer images. Listing images are displayed by reference to the dealer's own publicly accessible URL (hotlinking from the original source), which is standard indexing practice and does not constitute reproduction or redistribution.
              </>,
              <>
                <strong className="font-medium text-foreground">Registration requirement</strong> — Under 17 U.S.C. § 411, a copyright holder generally must register the work before filing an infringement suit for domestic works. Broad footer notices do not substitute for registration, and unregistered works are not eligible for statutory damages or attorney's fees.
              </>,
            ]} />

            <P>
              CartIQ does not copy, reproduce, or redistribute any dealer's original creative content —
              including proprietary photography, original written descriptions, logos, or branded marketing
              materials — without authorization. We index factual data and link users back to the dealer's
              own website for all further engagement.
            </P>

            <P>
              Dealers who prefer their inventory not be indexed by CartIQ may submit a removal request
              using the contact information in the section below. We will remove listings promptly upon
              a substantiated request. We also honor <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Robots-Tag: noindex</code> and{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">robots.txt</code> directives where present.
            </P>
          </Section>

          {/* 6 — Removal requests */}
          <Section
            id="removal-requests"
            icon={<Mail className="h-5 w-5" />}
            title="Removal Requests &amp; Corrections"
          >
            <P>
              If you are a dealer, seller, brand, or rights holder and believe a listing on CartIQ should be
              corrected, updated, or removed, we want to hear from you. We take these requests seriously and
              respond quickly.
            </P>
            <P>To submit a request, please include:</P>
            <Ul items={[
              "Your name and contact information (or company name if submitting on behalf of a dealer).",
              "The specific CartIQ listing URL or listing ID at issue.",
              "The correction or action you are requesting (price update, removal, image correction, etc.).",
              "A brief explanation of your relationship to the listing (dealer, seller, brand, etc.).",
            ]} />
            <P>
              Send requests to{" "}
              <a href="mailto:listings@cartiq.app" className="text-green-700 hover:underline font-medium">
                listings@cartiq.app
              </a>
              . We acknowledge all requests within 2 business days and resolve substantiated requests within
              10 business days.
            </P>
          </Section>

          {/* 6 — Contact */}
          <Section
            id="contact"
            icon={<Mail className="h-5 w-5" />}
            title="Contact &amp; Affiliations"
          >
            <P>
              CartIQ is an independent platform. We are not affiliated with, endorsed by, or sponsored by Club
              Car, E-Z-GO, Yamaha, Cushman, ICON, Bintelli, or any golf cart manufacturer. We are not affiliated
              with Facebook, Meta, Costco, or any third-party retail channel referenced on this platform.
            </P>
            <div className="grid sm:grid-cols-3 gap-4 mt-2">
              <div className="rounded-xl border border-border p-4 bg-white">
                <p className="font-semibold text-foreground text-sm mb-1">General</p>
                <a href="mailto:hello@cartiq.app" className="text-green-700 hover:underline text-sm break-all">
                  hello@cartiq.app
                </a>
              </div>
              <div className="rounded-xl border border-border p-4 bg-white">
                <p className="font-semibold text-foreground text-sm mb-1">Listings</p>
                <a href="mailto:listings@cartiq.app" className="text-green-700 hover:underline text-sm break-all">
                  listings@cartiq.app
                </a>
              </div>
              <div className="rounded-xl border border-border p-4 bg-white">
                <p className="font-semibold text-foreground text-sm mb-1">Dealers</p>
                <a href="mailto:dealers@cartiq.app" className="text-green-700 hover:underline text-sm break-all">
                  dealers@cartiq.app
                </a>
              </div>
            </div>
          </Section>

        </div>

        {/* Bottom nav */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} CartIQ · Florida &amp; Georgia Golf Cart Price Intelligence
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/buyer-guide" className="hover:text-foreground transition-colors">Buyer Guide</Link>
            <Link href="/deal-checker" className="hover:text-foreground transition-colors">Deal Checker</Link>
            <Link href="/search" className="hover:text-foreground transition-colors">Search Carts</Link>
          </div>
        </div>

      </div>
    </div>
  );
}

import { useEffect } from "react";
import { setSEO } from "@/lib/seo";
import { Link } from "wouter";
import {
  ShieldCheck, ExternalLink, BookOpen, AlertCircle,
  Mail, Scale, DollarSign, Camera, Database, UserCheck,
} from "lucide-react";

const LAST_UPDATED = "June 25, 2026";

// ─── Layout primitives ────────────────────────────────────────────────────────

function Section({ id, icon, title, children }: {
  id: string;
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
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
      <div className="text-sm text-green-900 leading-relaxed">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Disclosure() {
  useEffect(() => {
    setSEO({
      title: "GolfCartWise Disclosure | Listing Sources, Pricing Tools, and Sponsored Placement",
      description:
        "Learn how GolfCartWise displays golf cart listings, pricing tools, dealer sources, featured placements, and removal requests.",
      canonical: "https://golfcartwise.app/disclosure",
    });
  }, []);

  const navSections = [
    { id: "what-cartiq-is",          label: "What GolfCartWise Is" },
    { id: "where-listings-come-from",label: "Where Listings Come From" },
    { id: "lead-referral",           label: "Research & Lead-Referral" },
    { id: "how-we-display",          label: "How We Display Listings" },
    { id: "pricing-tools",           label: "Pricing Tools & Wise Deal Ratings" },
    { id: "featured-sponsored",      label: "Featured & Sponsored" },
    { id: "photos-sources",          label: "Photos & Source References" },
    { id: "copyright",               label: "Copyright & Factual Data" },
    { id: "data-we-dont-use",        label: "Data We Don't Use" },
    { id: "removal-requests",        label: "Removal Requests" },
    { id: "buyer-responsibility",    label: "Buyer Responsibility" },
    { id: "contact",                 label: "Contact & Affiliations" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            <span>Last updated: {LAST_UPDATED}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-3">Information Disclosure</h1>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            GolfCartWise is an independent golf cart research, comparison, pricing intelligence, and lead-referral
            platform focused on the Florida and Georgia golf cart market. This page explains where listings
            come from, how we display them, what our pricing tools do and don't represent, and how to contact
            us with questions or removal requests.
          </p>

          {/* Jump nav */}
          <nav className="mt-6 flex flex-wrap gap-2" aria-label="Disclosure sections">
            {navSections.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className="inline-flex items-center px-3 py-1 rounded-full border border-border text-xs text-muted-foreground hover:text-foreground hover:border-green-300 transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>

        {/* Sections */}
        <div className="space-y-12">

          {/* 1 — What GolfCartWise is */}
          <Section id="what-cartiq-is" icon={<ShieldCheck className="h-5 w-5" />} title="What GolfCartWise Is">
            <P>
              GolfCartWise helps buyers compare golf cart listings, dealer inventory, market pricing signals, battery
              types, features, warranties, delivery options, and seller options. GolfCartWise is designed to help
              buyers make better-informed decisions before contacting a dealer or seller.
            </P>
            <GreenBox label="GolfCartWise does not sell golf carts">
              GolfCartWise does not manufacture, sell, own, broker, finance, warrant, service, deliver, or inspect
              golf carts. GolfCartWise does not complete transactions on behalf of buyers, dealers, or sellers. Any
              purchase, negotiation, financing, delivery, warranty, service, title, registration, or related
              transaction occurs directly between the buyer and the dealer or seller.
            </GreenBox>
          </Section>

          {/* 2 — Where listings come from */}
          <Section id="where-listings-come-from" icon={<ExternalLink className="h-5 w-5" />} title="Where Listings Come From">
            <P>
              Listings and dealer information on GolfCartWise may come from several sources:
            </P>
            <ol className="space-y-2 pl-1 list-none">
              {[
                "Dealer-authorized inventory feeds, uploads, or submissions.",
                "Dealer websites or retail portals where inventory has been made publicly available for consumer discovery.",
                "Manufacturer or authorized retail channels where inventory is posted for public consumer browsing.",
                "Seller-submitted listings provided directly to GolfCartWise.",
                "GolfCartWise-created dealer profiles based on publicly available factual business information.",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
            <GreenBox label="We link back to the original source">
              GolfCartWise links back to the original dealer or seller source where available. GolfCartWise is a starting
              point for research and comparison. Buyers should confirm all listing details directly with the
              dealer or seller before making a purchase decision.
            </GreenBox>
          </Section>

          {/* 3 — Research & Lead-Referral */}
          <Section id="lead-referral" icon={<Scale className="h-5 w-5" />} title="Research and Lead-Referral Platform">
            <P>
              GolfCartWise is not a transaction marketplace.
            </P>
            <P>GolfCartWise does not:</P>
            <Ul items={[
              "Sell golf carts",
              "Own golf cart inventory",
              "Accept payment for golf carts",
              "Broker sales",
              "Negotiate purchases",
              "Arrange title transfer",
              "Provide warranties",
              "Provide financing",
              "Guarantee dealer performance",
              "Guarantee listing availability",
              "Guarantee final pricing",
            ]} />
            <P>
              When a buyer clicks through to a dealer website, contacts a dealer, calls a seller, or submits
              a lead form through GolfCartWise, any resulting communication, negotiation, purchase, financing,
              delivery, warranty, service, or title/registration process occurs directly between the buyer
              and the dealer or seller.
            </P>
            <GreenBox label="GolfCartWise is not a party to the transaction">
              GolfCartWise may help connect buyers with dealers or sellers, but GolfCartWise is not a party to the golf
              cart transaction.
            </GreenBox>
          </Section>

          {/* 4 — How we display */}
          <Section id="how-we-display" icon={<BookOpen className="h-5 w-5" />} title="How We Display Listings">
            <P>GolfCartWise may display factual listing information such as:</P>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                "Dealer or seller name", "Location", "Year", "Make", "Model",
                "Condition", "Asking price", "Battery type", "Seat count",
                "Power type", "Warranty information", "Delivery availability",
                "Financing availability", "Stock number", "Source URL",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <P>
              GolfCartWise may normalize formatting for consistency. For example, we may standardize model name
              capitalization, condition labels, market names, or battery categories. GolfCartWise does not
              intentionally change dealer-stated prices or core listing details. GolfCartWise may add
              platform-generated labels, Wise Deal Ratings, market categories, availability indicators, pricing
              estimates, or comparison notes for research purposes.
            </P>
            <P>
              Prices shown are based on the available listing information at the time of indexing or update.
              They may not reflect current availability, final dealer pricing, taxes, fees, delivery costs,
              financing terms, warranty terms, accessories, trade-in value, or other conditions.
            </P>
            <GreenBox label="Always confirm with the dealer">
              Buyers should always confirm details directly with the dealer or seller before making a
              purchase decision.
            </GreenBox>
          </Section>

          {/* 5 — Pricing Tools */}
          <Section id="pricing-tools" icon={<AlertCircle className="h-5 w-5" />} title="Pricing Tools and Wise Deal Ratings">
            <P>
              GolfCartWise may provide pricing intelligence tools such as GolfCartWise Value, Wise Deal Ratings, comparable
              listing analysis, market averages, and delivery-adjusted pricing estimates. These tools are
              estimates only.
            </P>
            <Ul items={[
              <>
                <strong className="font-medium text-foreground">GolfCartWise Value</strong> is an estimated
                fair-market comparison based on available listing data and comparable carts in the GolfCartWise
                index. It is not a certified appraisal.
              </>,
              <>
                <strong className="font-medium text-foreground">Deal ratings</strong> such as
                "Great Deal," "Good Deal," "Fair Price," "High Price," or "Over Market" reflect how a
                listing appears to compare against similar carts in the GolfCartWise index at that time.
              </>,
              <>
                <strong className="font-medium text-foreground">Delivery-adjusted pricing</strong> is an
                estimate based on available distance and market information. Actual delivery costs are set
                by the dealer or seller and may differ.
              </>,
            ]} />
            <P>GolfCartWise pricing tools are not:</P>
            <Ul items={[
              "Certified appraisals",
              "Purchase recommendations",
              "Binding price quotes",
              "Dealer offers",
              "Financing terms",
              "Legal advice",
              "Financial advice",
              "Guarantees of value",
              "Guarantees of availability",
            ]} />
            <P>All purchase decisions are made by the buyer and seller.</P>
          </Section>

          {/* 6 — Featured & Sponsored */}
          <Section id="featured-sponsored" icon={<DollarSign className="h-5 w-5" />} title="Featured Listings and Sponsored Placement">
            <P>
              Some listings, dealers, or market placements on GolfCartWise may be paid, sponsored, promoted, or
              featured. Featured or sponsored placements should be clearly labeled with terms such as
              "Featured," "Sponsored," "Promoted," or similar language.
            </P>
            <P>
              Paid placement may affect where a listing or dealer appears on GolfCartWise, but it does not allow
              a dealer or seller to hide pricing information, remove buyer-facing disclosures, suppress
              GolfCartWise Wise Deal Ratings, or override GolfCartWise's pricing transparency features.
            </P>
            <GreenBox label="Sponsorship does not change the transaction">
              GolfCartWise may receive compensation from dealers, advertisers, lenders, delivery partners,
              warranty providers, or other third-party partners. Sponsored or featured placement does not
              make GolfCartWise a party to any golf cart transaction.
            </GreenBox>
          </Section>

          {/* 7 — Photos */}
          <Section id="photos-sources" icon={<Camera className="h-5 w-5" />} title="Photos and Source References">
            <P>
              GolfCartWise respects the intellectual property rights of dealers, sellers, brands, photographers,
              and other rights holders. GolfCartWise does not claim ownership of third-party dealer or seller
              photos, logos, descriptions, or other creative content.
            </P>
            <Ul items={[
              "Listing images may be displayed by direct reference to the original source URL where technically available, or may be omitted unless provided or authorized by the dealer or seller.",
              "GolfCartWise does not download, store, alter, watermark, or rehost third-party listing images unless authorized.",
              "Where a listing references a third-party source, GolfCartWise links back to the original dealer or seller page when available.",
            ]} />
            <P>
              Dealers, sellers, photographers, brands, or rights holders may request correction, attribution
              review, or removal by contacting GolfCartWise at{" "}
              <a href="mailto:listings@golfcartwise.app" className="text-green-700 hover:underline font-medium">listings@golfcartwise.app</a>.
            </P>
          </Section>

          {/* 8 — Copyright */}
          <Section id="copyright" icon={<Scale className="h-5 w-5" />} title="Copyright, Factual Data, and Our Approach">
            <P>
              GolfCartWise is designed to index and compare factual listing information made publicly available
              for consumer discovery. Factual information may include year, make, model, condition, asking
              price, location, battery type, seat count, stock number, and dealer name.
            </P>
            <P>
              GolfCartWise's goal is to organize factual listing data for research and comparison while avoiding
              unauthorized copying of original creative expression, such as long-form descriptions,
              proprietary marketing copy, branded creative materials, dealer logos, or photography.
            </P>
            <GreenBox label="GolfCartWise content">
              GolfCartWise does not claim ownership of third-party content. GolfCartWise-created content — including
              platform design, Wise Deal Ratings, GolfCartWise Value estimates, pricing labels, market summaries,
              analytics, badges, and comparison tools — belongs to GolfCartWise or its licensors.
            </GreenBox>
            <P>
              Dealers, sellers, advertisers, and third parties may not copy, reproduce, display, frame,
              embed, or use GolfCartWise Wise Deal Ratings, pricing badges, valuation outputs, market analytics, or
              proprietary comparison tools outside the GolfCartWise platform without written permission.
            </P>
          </Section>

          {/* 9 — Data We Don't Use */}
          <Section id="data-we-dont-use" icon={<Database className="h-5 w-5" />} title="Data We Do Not Use">
            <P>GolfCartWise is deliberate about what data it does not collect or display.</P>
            <Ul items={[
              "GolfCartWise does not index or display Facebook Marketplace listings or content from Meta platforms.",
              "GolfCartWise does not index listings that require a login, private account, paid subscription, or restricted access to view.",
              "GolfCartWise does not intentionally collect private seller or buyer data from third-party platforms.",
              "GolfCartWise does not sell, share, or redistribute raw listing data to third parties.",
            ]} />
            <GreenBox label="Current scope">
              GolfCartWise's current scope is dealer inventory, authorized inventory sources, public-reference
              dealer information, and seller-submitted listings.
            </GreenBox>
          </Section>

          {/* 10 — Removal Requests */}
          <Section id="removal-requests" icon={<Mail className="h-5 w-5" />} title="Removal Requests and Corrections">
            <P>
              If you are a dealer, seller, brand, photographer, or rights holder and believe a listing,
              dealer profile, image reference, or other content on GolfCartWise should be corrected, attributed
              differently, updated, or removed, please contact us.
            </P>
            <P>To submit a request, include:</P>
            <Ul items={[
              "Your name and contact information",
              "Company name, if applicable",
              "The specific GolfCartWise listing URL or listing ID",
              "The source URL, if available",
              "The correction or action requested",
              "A brief explanation of your relationship to the listing or content",
            ]} />
            <P>
              Send listing, correction, and removal requests to{" "}
              <a href="mailto:listings@golfcartwise.app" className="text-green-700 hover:underline font-medium">
                listings@golfcartwise.app
              </a>. GolfCartWise will acknowledge requests within 2 business days and will review substantiated
              requests promptly. GolfCartWise may remove, update, suppress, or correct listings or image
              references while a request is under review.
            </P>
            <P>
              Dealers may also contact GolfCartWise to claim their profile, authorize inventory display, update
              contact information, submit corrected inventory, or opt out of public-reference inventory
              display.
            </P>
          </Section>

          {/* 11 — Buyer Responsibility */}
          <Section id="buyer-responsibility" icon={<UserCheck className="h-5 w-5" />} title="Buyer Responsibility">
            <P>Buyers are responsible for verifying all information before purchasing a golf cart.</P>
            <P>Before making a purchase decision, buyers should confirm:</P>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              {[
                "Final price",
                "Taxes and fees",
                "Availability",
                "Condition",
                "Battery type and battery age",
                "Charger inclusion",
                "Warranty coverage",
                "Delivery terms",
                "Financing terms",
                "Title, serial number, or ownership documents",
                "Street-legal or LSV compliance",
                "Local laws and registration requirements",
                "Dealer or seller reputation",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <GreenBox label="GolfCartWise is a research tool, not a substitute for due diligence">
              GolfCartWise is a research and comparison tool. It is not a substitute for buyer due diligence.
            </GreenBox>
          </Section>

          {/* 12 — Contact */}
          <Section id="contact" icon={<Mail className="h-5 w-5" />} title="Contact and Affiliations">
            <P>
              GolfCartWise is independent. GolfCartWise is not affiliated with, endorsed by, or sponsored by Club Car,
              E-Z-GO, Yamaha, Cushman, ICON, Bintelli, Facebook, Meta, Costco, or any other manufacturer,
              marketplace, or third-party retail channel unless expressly stated.
            </P>
            <div className="grid sm:grid-cols-3 gap-4 mt-2">
              {[
                { label: "General inquiries", email: "hello@golfcartwise.app" },
                { label: "Listings & corrections", email: "listings@golfcartwise.app" },
                { label: "Dealer & partnerships", email: "dealers@golfcartwise.app" },
              ].map(({ label, email }) => (
                <div key={email} className="rounded-xl border border-border p-4 bg-white">
                  <p className="font-semibold text-foreground text-sm mb-1">{label}</p>
                  <a href={`mailto:${email}`} className="text-green-700 hover:underline text-sm break-all">
                    {email}
                  </a>
                </div>
              ))}
            </div>
          </Section>

        </div>

        {/* Bottom nav */}
        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GolfCartWise · Florida &amp; Georgia Golf Cart Price Intelligence
          </p>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <Link href="/buyer-guide" className="hover:text-foreground transition-colors">Buyer Guide</Link>
            <Link href="/deal-checker" className="hover:text-foreground transition-colors">Deal Checker</Link>
            <Link href="/search" className="hover:text-foreground transition-colors">Search Carts</Link>
            <Link href="/how-it-works" className="hover:text-foreground transition-colors">How It Works</Link>
          </div>
        </div>

      </div>
    </div>
  );
}

import { useEffect } from "react";
import { setSEO, listingToProductSchema, breadcrumbSchema } from "@/lib/seo";
import { getBrandWikiByDbName } from "@/lib/brand-wiki-data";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, AlertTriangle, HelpCircle, CheckCircle, ExternalLink, Phone, Mail, Store, User, Truck, ShieldCheck } from "lucide-react";
import SaveButton from "@/components/SaveButton";
import WatchButton from "@/components/WatchButton";
import { ImageCarousel } from "@/components/ImageCarousel";
import { parseJsonField } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DealBadge, SourceBadge, WiseScoreBadge, WarrantyBadge, BatteryRiskBadge, StreetLegalBadge, DeliveryCostBadge, RetailSourceBadge } from "@/components/Badges";
import { MarketCompareCard } from "@/components/MarketCompareCard";
import { formatPrice, batteryTypeLabel, yesNoUnknownLabel, warrantyProviderLabel, parseJsonField, dealDeltaColor, dealDeltaText } from "@/lib/utils";
import type { Listing, Dealer } from "@/lib/types";
import { apiRequest } from "@/lib/queryClient";

// We run the pricing engine client-side so questions/redFlags are available
function usePricingResult(listing?: Listing) {
  if (!listing) return null;
  const redFlags = parseJsonField<string>(undefined);
  const questionsToAsk = parseJsonField<string>(undefined);
  return { redFlags, questionsToAsk };
}

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: listing, isLoading } = useQuery<Listing>({
    queryKey: ["/api/listings", id],
    queryFn: () => apiRequest("GET", `/api/listings/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const dealerSlug = listing?.syncSource;
  const { data: dealer } = useQuery<Dealer>({
    queryKey: ["/api/dealers", dealerSlug],
    queryFn: () => apiRequest("GET", `/api/dealers/${dealerSlug}`).then((r) => r.json()),
    enabled: !!dealerSlug && listing?.sellerType === "dealer",
    retry: false,
  });

  // SEO — injected once listing loads
  useEffect(() => {
    if (!listing) return;
    setSEO({
      title: listing.title,
      description: `${listing.year ?? ""} ${listing.brand ?? ""} ${listing.model ?? ""} for sale in ${listing.city ?? ""}, ${listing.state ?? ""}. Asking ${listing.askingPrice ? "$" + listing.askingPrice.toLocaleString() : "price TBD"} — GolfCartIQ GolfCartIQ Deal Rating: ${listing.dealRating ?? "unknown"}.`,
      image: listing.imageUrl ?? undefined,
      canonical: `https://golfcartiq.com/listing/${listing.slug ?? listing.id}`,
      jsonLd: [
        listingToProductSchema(listing),
        breadcrumbSchema([
          { name: "GolfCartIQ", url: "https://golfcartiq.com/" },
          { name: "Search", url: "https://golfcartiq.com/search" },
          { name: listing.title, url: `https://golfcartiq.com/listing/${listing.slug ?? listing.id}` },
        ]),
      ],
    });
  }, [listing]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-muted-foreground">
        <p className="text-lg font-medium mb-2">Listing not found</p>
        <Link href="/search"><Button variant="outline">Back to Search</Button></Link>
      </div>
    );
  }

  const effectivePrice = listing.salePrice ?? listing.askingPrice ?? listing.regularPrice;

  // Generate questions and red flags from listing data
  const questions: string[] = [];
  const redFlags: string[] = [];

  if (listing.chargerIncluded === "unknown") questions.push("Is the correct charger included and matched to the battery type and voltage?");
  if (listing.warrantyIncluded === "unknown") questions.push("Is any dealer, manufacturer, battery, retailer, or third-party warranty included?");
  if (listing.batteryType === "lithium" && listing.batteryWarrantyIncluded === "unknown") questions.push("Is there a separate lithium battery warranty, and is it transferable?");
  if (listing.streetLegalClaimed) {
    questions.push("Is there a title and VIN for this cart?");
    questions.push("Is it registered as an LSV (Low-Speed Vehicle)?");
    questions.push("Are seat belts, mirrors, turn signals, brake lights, and windshield present?");
    redFlags.push("Seller claims street legal, but title/VIN/registration should be independently verified.");
  }
  if (listing.batteryType === "lead_acid" && (listing.batteryAgeMonths == null || listing.batteryAgeMonths > 48)) {
    redFlags.push("Lead-acid battery age is unknown or over 4 years. Factor in replacement cost ($800–$1,500).");
  }
  if (listing.chargerIncluded === "no") redFlags.push("Charger not included. Confirm compatible charger cost before buying.");
  if (listing.warrantyIncluded === "no" && (listing.sellerType === "dealer" || listing.sellerType === "retail")) {
    redFlags.push("No warranty listed for a dealer or retail cart. Treat as as-is unless confirmed otherwise in writing.");
  }
  if (listing.batteryAh && listing.batteryAh <= 105 && (listing.seating && listing.seating >= 6 || listing.lifted)) {
    redFlags.push(`Battery size (${listing.batteryAh}Ah) may be light for this setup. Confirm real-world range with passengers.`);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Back */}
        <Link href="/search" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Search
          </Link>

        {/* Image Carousel */}
        {(() => {
          const extraImages = parseJsonField<string>(listing.imageUrls);
          const allImages = extraImages.length > 0
            ? extraImages
            : listing.imageUrl ? [listing.imageUrl] : [];
          return (
            <div className="relative mb-6">
              <ImageCarousel images={allImages} alt={listing.title} aspectClass="aspect-[16/7]" />
              {/* Overlay badges */}
              <div className="absolute top-3 left-3 flex gap-2 z-20">
                <DealBadge rating={listing.dealRating} />
                <SourceBadge sellerType={listing.sellerType} sourceType={listing.sourceType} retailerName={listing.retailerName} />
              </div>
              <div className="absolute top-3 right-3 flex gap-1.5 z-20">
                <SaveButton listingId={listing.id} size="md" />
                <WatchButton listingId={listing.id} size="md" />
              </div>
            </div>
          );
        })()}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="md:col-span-2 space-y-5">
            <div>
              <h1 className="text-xl font-bold leading-snug">{listing.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">{listing.city}{listing.city && listing.state ? ", " : ""}{listing.state}</p>
              {listing.brand && (() => {
                const wiki = getBrandWikiByDbName(listing.brand);
                return wiki ? (
                  <Link href={`/brands/${wiki.slug}`} className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline mt-1">
                    Learn more about {wiki.name} →
                  </Link>
                ) : null;
              })()}
            </div>

            {/* Pricing block */}
            <Card>
              <CardContent className="pt-5 space-y-3">
                {listing.sellerType === "retail" && listing.regularPrice && listing.salePrice && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground line-through text-sm">{formatPrice(listing.regularPrice)}</span>
                    <span className="text-2xl font-bold text-green-700">{formatPrice(listing.salePrice)}</span>
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">Sale Price</span>
                  </div>
                )}
                {(!listing.salePrice || listing.sellerType !== "retail") && (
                  <div className="text-2xl font-bold">{formatPrice(effectivePrice)}</div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">GolfCartIQ Value</span>
                  <span className="font-semibold">{formatPrice(listing.cartiqEstimatedValue)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Delivery Cost</span>
                  <DeliveryCostBadge deliveryIncluded={listing.deliveryIncluded} deliveryCost={listing.estimatedDeliveryCost} deliveryAvailable={listing.deliveryAvailable} />
                </div>
                {listing.totalDeliveredCost && (
                  <div className="flex items-center justify-between text-sm border-t pt-2">
                    <span className="text-muted-foreground font-medium">Total Delivered Cost</span>
                    <span className="font-bold">{formatPrice(listing.totalDeliveredCost)}</span>
                  </div>
                )}
                <div className={`text-base font-bold ${dealDeltaColor(listing.dealDelta)}`}>{dealDeltaText(listing.dealDelta)}</div>
                {listing.sellerType === "retail" && listing.lastVerifiedAt && (
                  <p className="text-xs text-muted-foreground">Price/availability last verified: {listing.lastVerifiedAt}</p>
                )}
              </CardContent>
            </Card>

            {/* Buyer Intelligence */}
            <Card>
              <CardHeader><CardTitle className="text-base">Buyer Intelligence</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Battery Type", batteryTypeLabel(listing.batteryType)],
                    ["Battery Size", listing.batteryAh ? `${listing.batteryAh}Ah` : "Unknown"],
                    ["Battery Age", listing.batteryAgeMonths ? `${listing.batteryAgeMonths} months` : "Unknown"],
                    ["Power Type", listing.powerType || "Unknown"],
                    ["Seating", listing.seating ? `${listing.seating} passengers` : "Unknown"],
                    ["Lifted", listing.lifted ? "Yes" : "No"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <BatteryRiskBadge batteryType={listing.batteryType} batteryAh={listing.batteryAh} />
                  <WarrantyBadge warrantyIncluded={listing.warrantyIncluded} warrantyMonths={listing.warrantyMonths} />
                  <StreetLegalBadge streetLegalClaimed={listing.streetLegalClaimed} streetLegalConfidence={listing.streetLegalConfidence} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  {[
                    ["Charger Included", yesNoUnknownLabel(listing.chargerIncluded)],
                    ["Street Legal Claimed", listing.streetLegalClaimed ? "Yes" : "No"],
                    ["Street Legal Confidence", listing.streetLegalConfidence || "Unknown"],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Warranty Panel */}
            <Card>
              <CardHeader><CardTitle className="text-base">Warranty</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["Warranty Included", yesNoUnknownLabel(listing.warrantyIncluded)],
                    ["Warranty Provider", warrantyProviderLabel(listing.warrantyProvider)],
                    ["Warranty Length", listing.warrantyMonths ? `${listing.warrantyMonths} months` : "Unknown"],
                    ["Battery Warranty", yesNoUnknownLabel(listing.batteryWarrantyIncluded)],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>
                {listing.warrantyNotes && <p className="text-xs text-muted-foreground pt-2">{listing.warrantyNotes}</p>}
                {listing.warrantyIncluded === "unknown" && (
                  <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-800 flex gap-2 mt-2">
                    <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    Ask seller: Is any dealer, manufacturer, battery, retailer, or third-party warranty included?
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dealer Info — delivery & warranty offered by the dealer */}
            {dealer && (
              <Card>
                <CardHeader><CardTitle className="text-base">Dealer Info</CardTitle></CardHeader>
                <CardContent className="space-y-4 text-sm">
                  {/* Delivery */}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Delivery</span>
                    </div>
                    {dealer.deliveryAvailable ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                          <CheckCircle className="h-3 w-3" /> Delivery Available
                        </span>
                        <p className="text-muted-foreground">
                          {dealer.deliveryIncluded
                            ? "Free delivery included"
                            : (dealer.deliveryFreeRadiusMiles && dealer.deliveryFreeRadiusMiles > 0)
                              ? `Free within ${dealer.deliveryFreeRadiusMiles} miles`
                              : (dealer.deliveryBaseFee && dealer.deliveryBaseFee > 0)
                                ? `Delivery fee: ${formatPrice(dealer.deliveryBaseFee)}`
                                : "Contact dealer for delivery details"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Local pickup only</p>
                    )}
                  </div>

                  {/* Warranty */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">Warranty</span>
                    </div>
                    {dealer.defaultWarrantyIncluded ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-200">
                          <CheckCircle className="h-3 w-3" /> Warranty Available
                        </span>
                        {dealer.defaultWarrantyMonths != null && dealer.defaultWarrantyMonths > 0 && (
                          <p className="text-muted-foreground">{dealer.defaultWarrantyMonths}-month warranty</p>
                        )}
                        {dealer.defaultWarrantyNotes && (
                          <p className="text-muted-foreground text-xs">{dealer.defaultWarrantyNotes.slice(0, 120)}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No dealer warranty</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Retail source notice */}
            {listing.sellerType === "retail" && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800 space-y-1">
                <p className="font-semibold">Retail / {listing.retailerName || "Retailer"} Listing</p>
                <p>GolfCartIQ does not guarantee retailer price or availability. Retail prices, availability, shipping, delivery, warranty, and state eligibility may change. Verify all details on the retailer site before purchase.</p>
                {listing.retailerProductUrl && (
                  <a href={listing.retailerProductUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-purple-700 font-medium hover:underline text-xs mt-1">
                    View on {listing.retailerName || "Retailer"} <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}

            {/* Red Flags */}
            {redFlags.length > 0 && (
              <Card className="border-red-200">
                <CardHeader><CardTitle className="text-base text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Red Flags</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {redFlags.map((flag, i) => (
                      <li key={i} className="flex gap-2 text-sm text-red-700 bg-red-50 p-2.5 rounded">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {flag}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Questions to Ask */}
            {questions.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Questions to Ask the Seller</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {questions.map((q, i) => (
                      <li key={i} className="flex gap-2 text-sm bg-blue-50 p-2.5 rounded text-blue-800">
                        <HelpCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {q}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Description */}
            {listing.description && (
              <Card>
                <CardHeader><CardTitle className="text-base">Listing Description</CardTitle></CardHeader>
                <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{listing.description}</p></CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            <MarketCompareCard listing={listing} />
            <WiseScoreBadge score={listing.buyerScore} className="text-lg" />
            <a href="/how-it-works" className="block text-xs text-green-700 hover:underline text-right -mt-3">
              How is this score calculated? →
            </a>

            {/* Contact Card */}
            <div className="border border-border rounded-xl p-4 space-y-3 bg-white">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Point of Contact</p>

              <div className="flex items-center gap-2">
                {listing.sellerType === "dealer" || listing.sellerType === "retail"
                  ? <Store size={15} className="text-muted-foreground shrink-0" />
                  : <User size={15} className="text-muted-foreground shrink-0" />}
                <span className="text-sm font-semibold text-foreground">
                  {listing.sellerName ?? (listing.sellerType === "dealer" ? "Dealer" : "Private Seller")}
                </span>
              </div>

              {listing.sellerPhone && (
                <a
                  href={`tel:${listing.sellerPhone.replace(/\D/g, "")}`}
                  className="flex items-center gap-2 text-sm text-green-700 hover:text-green-900 font-medium"
                >
                  <Phone size={14} />
                  {listing.sellerPhone}
                </a>
              )}

              {listing.sellerEmail && !listing.sellerEmail.endsWith(".local") && (
                <a
                  href={`mailto:${listing.sellerEmail}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Mail size={14} />
                  {listing.sellerEmail}
                </a>
              )}

              {listing.sourceUrl && (
                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <ExternalLink size={14} />
                  Visit Dealer Website
                </a>
              )}

              {/* CTAs */}
              <div className="space-y-2 pt-1">
                {listing.sellerType === "retail" && listing.retailerProductUrl ? (
                  <a href={listing.retailerProductUrl} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full gap-2" data-testid="btn-view-retailer"><ExternalLink className="h-4 w-4" /> View Retailer</Button>
                  </a>
                ) : listing.sellerPhone ? (
                  <a href={`tel:${listing.sellerPhone.replace(/\D/g, "")}`}>
                    <Button className="w-full gap-2" data-testid="btn-contact-seller"><Phone className="h-4 w-4" /> Call Seller</Button>
                  </a>
                ) : (
                  <Button className="w-full gap-2" data-testid="btn-contact-seller"><Phone className="h-4 w-4" /> Contact Seller</Button>
                )}
                <Link href="/deal-checker"><Button variant="outline" className="w-full" data-testid="btn-check-similar">Check Similar Deals</Button></Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

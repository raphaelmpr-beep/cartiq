import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, MapPin, ChevronDown, Search, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "/search", label: "Search Carts" },
  { href: "/deal-checker", label: "Deal Checker" },
  { href: "/brands", label: "Brands" },
  { href: "/buyer-guide", label: "Buyer Guide" },
  { href: "/sell", label: "Sell My Cart" },
  { href: "/garage", label: "My Garage" },
];

export function Header() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-sm border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <a className="flex items-center gap-2">
            <svg viewBox="0 0 32 32" className="h-8 w-8" fill="none" aria-label="GolfCartWise logo">
              <rect width="32" height="32" rx="8" fill="hsl(220,13%,13%)" />
              <path d="M6 20L12 10L18 16L22 12L26 20" stroke="hsl(142,76%,56%)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="10" r="2" fill="hsl(142,76%,56%)" />
            </svg>
            <span className="font-bold text-xl tracking-tight text-foreground">GolfCart<span className="text-green-600">Wise</span></span>
          </a>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1" data-testid="desktop-nav">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              <a className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location === link.href
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}>
                {link.label}
              </a>
            </Link>
          ))}
        </nav>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-2">
          <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors">
            <MapPin className="h-3.5 w-3.5" />
            <span>Jacksonville, FL</span>
            <ChevronDown className="h-3 w-3" />
          </button>
          <Link href="/admin">
            <a>
              <Button variant="outline" size="sm" data-testid="admin-login-btn">Admin</Button>
            </a>
          </Link>
          <Link href="/search">
            <a>
              <Button size="sm" className="gap-1.5" data-testid="header-search-btn">
                <Search className="h-3.5 w-3.5" /> Search Carts
              </Button>
            </a>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <button className="md:hidden p-2 rounded-md hover:bg-secondary" data-testid="mobile-menu-btn" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-lg">GolfCart<span className="text-green-600">Wise</span></span>
              <button onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4 px-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>Jacksonville, FL</span>
            </div>
            <nav className="space-y-1">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href}>
                  <a
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-3 rounded-md text-sm font-medium hover:bg-secondary transition-colors"
                  >
                    {link.label}
                  </a>
                </Link>
              ))}
              <Link href="/admin">
                <a onClick={() => setMobileOpen(false)} className="block px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-secondary">
                  Admin Portal
                </a>
              </Link>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

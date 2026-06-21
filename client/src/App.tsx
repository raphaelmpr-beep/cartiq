import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <h1 className="text-lg font-bold mb-2">Something went wrong</h1>
            <p className="text-sm text-muted-foreground mb-4">Try refreshing the page.</p>
            <button onClick={() => window.location.reload()} className="text-sm text-green-700 hover:underline">Refresh</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Header } from "@/components/Header";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import ListingDetail from "@/pages/ListingDetail";
import DealChecker from "@/pages/DealChecker";
import { BuyerGuideIndex, ArticleDetail } from "@/pages/BuyerGuide";
import Admin from "@/pages/Admin";
import MyGarage from "@/pages/MyGarage";

function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted-foreground mb-4">The page you're looking for doesn't exist.</p>
        <a href="/#/" className="text-green-600 hover:underline">Go Home</a>
      </div>
    </div>
  );
}

function SellPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <h1 className="text-xl font-bold mb-2">Sell My Cart</h1>
        <p className="text-muted-foreground text-sm">
          Seller-authorized listing import is coming soon. For now, contact us to list your cart on CartIQ.
        </p>
      </div>
    </div>
  );
}

function AppRoutes() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/search" component={Search} />
          <Route path="/listing/:id" component={ListingDetail} />
          <Route path="/deal-checker" component={DealChecker} />
          <Route path="/buyer-guide" component={BuyerGuideIndex} />
          <Route path="/buyer-guide/:slug" component={ArticleDetail} />
          <Route path="/sell" component={SellPage} />
          <Route path="/garage" component={MyGarage} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <footer className="border-t border-border bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">Cart<span className="text-green-600">IQ</span></span>
            <span>Golf cart pricing intelligence — Florida & Georgia</span>
          </div>
          <div className="flex gap-4">
            <a href="/#/buyer-guide" className="hover:text-foreground">Buyer Guide</a>
            <a href="/#/deal-checker" className="hover:text-foreground">Deal Checker</a>
            <a href="/#/search" className="hover:text-foreground">Search</a>
            <a href="/#/garage" className="hover:text-foreground">My Garage</a>
            <a href="/#/admin" className="hover:text-foreground">Admin</a>
          </div>
          <p>© {new Date().getFullYear()} CartIQ. Not affiliated with Facebook, Costco, or any manufacturer.</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Router hook={useHashLocation}>
          <AppRoutes />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

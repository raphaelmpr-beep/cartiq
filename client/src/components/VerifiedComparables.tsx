import { useEffect, useState } from "react";
import { Link } from "wouter";
import type { CompInput, CompResponse } from "@shared/growth";
import { trackGrowth } from "@/lib/growth";
import { Button } from "@/components/ui/button";

function CartImage({src,title}:{src:string;title:string}) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  return failed
    ? <div role="img" aria-label={`Image unavailable for ${title}`} className="w-full h-40 bg-muted flex items-center justify-center text-sm text-muted-foreground">Cart image unavailable</div>
    : <img src={src} alt={title} className="w-full h-40 object-cover bg-muted" loading="lazy" onError={()=>setFailed(true)}/>;
}
export function VerifiedComparables({input}:{input:CompInput}) {
  const [data,setData] = useState<CompResponse|null>(null);
  const [error,setError] = useState(false);
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    setData(null); setError(false);
    fetch("/api/valuation/comparables",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:abort.signal})
      .then(async r => {if(!r.ok) throw new Error(); return r.json();})
      .then((d:CompResponse) => {setData(d); if(d.items.length) trackGrowth("comps_view");})
      .catch(() => {if(!abort.signal.aborted) setError(true);});
    return () => abort.abort();
  },[input,retry]);
  return <section className="rounded-xl border border-border bg-white p-5 space-y-4" aria-label="Verified comparable carts">
    <div><h2 className="text-xl font-bold">Verified comparable carts</h2>
      <p className="text-sm text-muted-foreground mt-1">Dealer asking prices, not completed sales. Source price and branch checked within 7 days; confirm current availability with the dealer. These listings do not determine the formula estimate above.</p></div>
    {!data && !error && <p role="status">Checking comparable inventory…</p>}
    {error && <div role="alert"><p>Comparable inventory is temporarily unavailable. No unchecked listings are substituted.</p><Button className="mt-3" variant="outline" onClick={()=>setRetry(v=>v+1)}>Retry comparable search</Button></div>}
    {data && <p className="text-sm" role="status">{data.message}</p>}
    <div className="grid sm:grid-cols-2 gap-4">{data?.items.map(cart=><article key={cart.id} className="border border-border rounded-lg overflow-hidden">
      <CartImage src={cart.imageUrl} title={cart.title}/>
      <div className="p-4 space-y-2">
        <h3 className="font-semibold">{cart.title}</h3><p className="text-xl font-bold text-green-700">{cart.askingPrice.toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0})} <span className="text-xs font-normal text-muted-foreground">asking price</span></p>
        <p className="text-sm">{cart.dealer} · {cart.city}, {cart.state}</p>
        <ul className="text-xs text-muted-foreground space-y-1">{cart.reasons.map(r=><li key={r}>{r}</li>)}</ul>
        <p className="text-xs">Source checked {new Date(cart.checkedAt).toLocaleDateString("en-US",{timeZone:"UTC"})} (UTC)</p>
        <Link href={`/listing/${cart.slug}`} onClick={()=>trackGrowth("comp_click",{listingId:cart.id})} className="block text-green-700 underline font-medium">View cart details</Link>
        <a href={cart.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={()=>trackGrowth("dealer_contact_click",{listingId:cart.id,channel:"website"})} className="block text-sm underline">Check dealer listing</a>
      </div>
    </article>)}</div>
  </section>;
}

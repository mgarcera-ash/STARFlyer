"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import { FaSafari, FaSms } from "react-icons/fa";
import { MdEmail } from "react-icons/md";
import { supabase } from "@/lib/supabase";


type Hotspot = { type: "phone" | "sms" | "email" | "address" | "website"; label?: string; value: string };

type Flyer = {
  id: string;
  title: string;
  entity: string | null;
  description: string | null;
  tags: string[] | null;
  image_url: string | null;
  status: string;
  created_at: string | null;
  approved_at: string | null;
  hotspots: Hotspot[] | null;
};

export default function Home() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [allEntities, setAllEntities] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeEntities, setActiveEntities] = useState<string[]>([]);
  const [filterTab, setFilterTab] = useState<"topics" | "agency">("agency");
  const [filterOpen, setFilterOpen] = useState(false);
  const [preview, setPreview] = useState<Flyer | null>(null);
  const [previewInitialSearch, setPreviewInitialSearch] = useState("");
  const [quickLook, setQuickLook] = useState<Flyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);
  const [gridKey, setGridKey] = useState(0);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashOut, setSplashOut] = useState(false);
  const [firstLineVisible, setFirstLineVisible] = useState(false);
  const [countVisible, setCountVisible] = useState(false);
  const [displayCount, setDisplayCount] = useState(0);
  const [minTimeReady, setMinTimeReady] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [shortcutsClosing, setShortcutsClosing] = useState(false);
  const closeShortcuts = () => {
    setShortcutsClosing(true);
    setTimeout(() => { setShortcutsOpen(false); setShortcutsClosing(false); }, 180);
  };

  // Skip splash if already shown this session
  useEffect(() => {
    if (sessionStorage.getItem("splashShown") === "1") {
      setSplashVisible(false);
      setVisible(true);
      setMinTimeReady(true);
      setImagesReady(true);
    }
  }, []);

  // Splash text sequence
  useEffect(() => {
    const first = setTimeout(() => setFirstLineVisible(true), 500);
    return () => clearTimeout(first);
  }, []);

  useEffect(() => {
    if (!firstLineVisible) return;
    const count = setTimeout(() => setCountVisible(true), 500);
    return () => clearTimeout(count);
  }, [firstLineVisible]);

  // Minimum splash time: 4s
  useEffect(() => {
    const t = setTimeout(() => setMinTimeReady(true), 4000);
    return () => clearTimeout(t);
  }, []);

  // Preload images once flyers are fetched, cap at 10s
  useEffect(() => {
    if (flyers.length === 0) return;
    const cap = setTimeout(() => setImagesReady(true), 10000);
    const urls = flyers.map(f => f.image_url).filter(Boolean) as string[];
    Promise.all(urls.map(url => new Promise<void>(resolve => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    }))).then(() => setImagesReady(true));
    return () => clearTimeout(cap);
  }, [flyers]);

  // Exit splash when both conditions met — 1.5s buffer after ready
  useEffect(() => {
    if (!minTimeReady || !imagesReady) return;
    const fadeOut = setTimeout(() => { setSplashOut(true); setVisible(true); }, 1500);
    const remove = setTimeout(() => { setSplashVisible(false); sessionStorage.setItem("splashShown", "1"); }, 2100);
    return () => { clearTimeout(fadeOut); clearTimeout(remove); };
  }, [minTimeReady, imagesReady]);

  useEffect(() => {
    if (!countVisible || flyers.length === 0) return;
    const duration = 1500;
    const start = performance.now();
    const target = flyers.length;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCount(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [countVisible, flyers.length]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setGridKey(k => k + 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    async function fetchFlyers() {
      const { data } = await supabase
        .from("flyers")
        .select("*")
        .eq("status", "approved")
        .order("created_at", { ascending: false });
      const flyerList = data || [];
      setFlyers(flyerList);

      // Collect unique tags and entities across all flyers
      const tagSet = new Set<string>();
      const entitySet = new Set<string>();
      flyerList.forEach(f => {
        f.tags?.forEach((t: string) => tagSet.add(t));
        if (f.entity) entitySet.add(f.entity);
      });
      setAllTags(Array.from(tagSet).sort());
      setAllEntities(Array.from(entitySet).sort());

      setLoading(false);
    }
    fetchFlyers();
  }, []);

  const toggleTag = (tag: string) => {
    setActiveTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
    setGridKey(k => k + 1);
  };

  const toggleEntity = (entity: string) => {
    setActiveEntities(prev =>
      prev.includes(entity) ? prev.filter(e => e !== entity) : [...prev, entity]
    );
    setGridKey(k => k + 1);
  };

  // Alphabet index
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const tagsByLetter = useMemo(() => {
    const groups: Record<string, string[]> = {};
    allTags.forEach(tag => {
      const letter = tag[0]?.toUpperCase() ?? "#";
      if (!groups[letter]) groups[letter] = [];
      groups[letter].push(tag);
    });
    return groups;
  }, [allTags]);

  const availableLetters = useMemo(() => Object.keys(tagsByLetter).sort(), [tagsByLetter]);

  const topicRows = useMemo(() => {
    return allTags
      .map(tag => ({ tag, flyers: flyers.filter(f => f.tags?.includes(tag)) }))
      .filter(r => r.flyers.length >= 3);
  }, [allTags, flyers]);

  const entityRows = useMemo(() => {
    return allEntities
      .map(entity => ({ entity, flyers: flyers.filter(f => f.entity === entity) }))
      .filter(r => r.flyers.length >= 3);
  }, [allEntities, flyers]);

  const scrollToLetter = (letter: string) => {
    const el = sectionRefs.current[letter];
    const container = panelScrollRef.current;
    if (el && container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      container.scrollTop += elTop - containerTop - 8;
    }
  };

  // Auto-focus search input when overlay opens
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "Escape") {
        if (shortcutsOpen) { closeShortcuts(); }
        else if (filterOpen) { setFilterOpen(false); }
        else if (searchOpen) { setSearchOpen(false); setSearchInput(""); setActiveTags([]); setActiveEntities([]); setGridKey(k => k + 1); searchInputRef.current?.blur(); }
        return;
      }

      // Type to search — printable single char, not in an input, no modifiers
      if (!searchOpen && !inInput && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setSearchOpen(true);
        setSearchInput(e.key);
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [filterOpen, searchOpen, shortcutsOpen]);

  const filtered = flyers.filter(f => {
    const q = search.toLowerCase();
    const matchSearch =
      q === "" ||
      f.title.toLowerCase().includes(q) ||
      f.entity?.toLowerCase().includes(q) ||
      f.description?.toLowerCase().includes(q) ||
      f.tags?.some(t => t.toLowerCase().includes(q)) ||
      f.hotspots?.some(s =>
        s.label?.toLowerCase().includes(q) || s.value.toLowerCase().includes(q)
      );
    const matchTags =
      activeTags.length === 0 ||
      activeTags.some(t => f.tags?.includes(t));
    const matchEntities =
      activeEntities.length === 0 ||
      (f.entity != null && activeEntities.includes(f.entity));
    return matchSearch && matchTags && matchEntities;
  });

  type FlyerGroup = {
    flyer: Flyer;
    hotspotsByType: Partial<Record<Hotspot["type"], Hotspot[]>>;
    isFallback: boolean;
  };

  const showGrouped = search !== "" || activeTags.length > 0;

  const flyerGroups: FlyerGroup[] = showGrouped ? filtered.map(f => {
    const q = search.toLowerCase();
    const matchingHotspots = search !== ""
      ? (f.hotspots?.filter(h =>
          h.label?.toLowerCase().includes(q) || h.value.toLowerCase().includes(q)
        ) ?? [])
      : (f.hotspots?.filter(h =>
          activeTags.some(tag =>
            h.label?.toLowerCase().includes(tag.toLowerCase()) || h.value.toLowerCase().includes(tag.toLowerCase())
          )
        ) ?? []);
    const hotspotsByType: Partial<Record<Hotspot["type"], Hotspot[]>> = {};
    for (const h of matchingHotspots) {
      if (!hotspotsByType[h.type]) hotspotsByType[h.type] = [];
      hotspotsByType[h.type]!.push(h);
    }
    return { flyer: f, hotspotsByType, isFallback: matchingHotspots.length === 0 };
  }) : [];

  return (
    <>

      {/* Splash screen */}
      {splashVisible && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "#000",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 32,
          opacity: splashOut ? 0 : 1,
          transition: "opacity 0.6s ease",
          pointerEvents: splashOut ? "none" : "auto",
        }}>
          {/* Floating bubbles — inside splash so black bg contains them */}
          {[
            { emoji: "📸", left: "7%",  delay: "0s",    duration: "8s",   size: "28px" },
            { emoji: "🤳", left: "18%", delay: "1.5s",  duration: "9s",   size: "24px" },
            { emoji: "📸", left: "32%", delay: "3s",    duration: "7.5s", size: "22px" },
            { emoji: "🤳", left: "48%", delay: "0.75s", duration: "8.5s", size: "30px" },
            { emoji: "📸", left: "63%", delay: "2.25s", duration: "8s",   size: "24px" },
            { emoji: "🤳", left: "76%", delay: "1s",    duration: "9s",   size: "26px" },
            { emoji: "📸", left: "88%", delay: "3.5s",  duration: "7.5s", size: "22px" },
          ].map(({ emoji, left, delay, duration, size }, i) => (
            <span
              key={i}
              className="bubble-float"
              style={{ "--left": left, "--delay": delay, "--duration": duration, "--size": size, zIndex: 1 } as React.CSSProperties}
            >{emoji}</span>
          ))}

          <div style={{ position: "relative", zIndex: 2 }}>

            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600,
              color: "#fff", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em",
              opacity: firstLineVisible ? 1 : 0,
              transition: "opacity 0.8s ease",
            }}>
              Find the right resource.
            </p>
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 400,
              color: "#fff", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em",
              opacity: countVisible ? 1 : 0,
              transition: "opacity 0.8s ease",
            }}>
              {(() => {
                const colors = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#14b8a6", "#06b6d4", "#a855f7"];
                const color = colors[displayCount % colors.length];
                return <>To date, the STAR team has uploaded <span style={{ color, transition: "color 0.05s" }}>{displayCount}</span> flyers for you.</>;
              })()}
            </p>

            {/* Loading indicator */}
            <p style={{
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 400,
              color: "rgba(255,255,255,0.4)", margin: "16px 0 0", letterSpacing: "0.01em",
              opacity: countVisible && !imagesReady ? 1 : 0,
              transition: "opacity 0.5s ease",
            }}>
              Almost done loading<span className="loading-dot">.</span><span className="loading-dot">.</span><span className="loading-dot">.</span>
            </p>
          </div>
        </div>
      )}

      <main style={{ minHeight: "100vh", padding: `${searchOpen ? 92 : 80}px 0 48px`, opacity: visible ? 1 : 0, transition: "opacity 0.4s ease, padding-top 0.3s ease" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", paddingLeft: 24, paddingRight: 24 }}>

          {!loading && (
            <div style={{
              overflow: "hidden",
              maxHeight: searchOpen ? 0 : 120,
              opacity: searchOpen ? 0 : 1,
              marginBottom: searchOpen ? 0 : 32,
              transition: "max-height 0.3s ease, opacity 0.2s ease, margin-bottom 0.3s ease",
            }}>
              <div className="fade-up" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 600, color: "var(--text)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em" }}>
                    Find the right resource.
                  </p>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 22, fontWeight: 400, color: "var(--muted)", lineHeight: 1.3, margin: 0, letterSpacing: "-0.02em" }}>
                    Browse {flyers.length} flyers below.
                  </p>
                </div>
                <button
                  onClick={() => setSearchOpen(true)}
                  style={{
                    flexShrink: 0,
                    width: 52, height: 52, borderRadius: "50%",
                    background: "var(--text)", border: "1.5px solid var(--text)",
                    cursor: "pointer", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    position: "relative",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "#fff"; b.style.color = "var(--text)"; }}
                  onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--text)"; b.style.color = "#fff"; }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {loading && (
            <p style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>Loading…</p>
          )}

          {/* Grouped search / filter results */}
          {!loading && showGrouped && (() => {
            const hotspotMeta: Record<Hotspot["type"], { bg: string; label: string; icon: React.ReactNode }> = {
              phone:   { bg: "#22c55e", label: "Phones",    icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg> },
              sms:     { bg: "#06b6d4", label: "SMS",       icon: <FaSms size={13} color="#fff" /> },
              email:   { bg: "#f97316", label: "Email",     icon: <MdEmail size={13} color="#fff" /> },
              address: { bg: "#ef4444", label: "Addresses", icon: <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#fff"/></svg> },
              website: { bg: "#3b82f6", label: "Websites",  icon: <FaSafari size={13} color="#fff" /> },
            };
            const typeOrder: Hotspot["type"][] = ["phone", "sms", "email", "address", "website"];
            const fallbacks = flyerGroups.filter(g => g.isFallback);
            const matched   = flyerGroups.filter(g => !g.isFallback);
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
                {flyerGroups.length === 0 && (
                  <p style={{ color: "var(--muted)", fontSize: 14, fontFamily: "var(--font-sans)", paddingTop: 24 }}>
                    No flyers match your search.
                  </p>
                )}

                {/* Fallback flyers — normal cards */}
                {fallbacks.length > 0 && (
                  <div>
                    <p style={{ margin: "0 0 14px", fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>
                      {fallbacks.length} {fallbacks.length === 1 ? "flyer" : "flyers"} found.
                    </p>
                    <div key={gridKey} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, alignItems: "start" }}>
                      {fallbacks.map(({ flyer }, i) => (
                        <FlyerCard
                          key={flyer.id}
                          flyer={flyer}
                          search={search}
                          showEntity={activeEntities.length > 0}
                          onQuickLook={(initialSearch = "") => { setPreviewInitialSearch(initialSearch); setQuickLook(flyer); }}
                          onPreview={(initialSearch = "") => { setPreviewInitialSearch(initialSearch); setPreview(flyer); }}
                          animationDelay={i * 0.06}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Matched flyers — dark grouped contact cards */}
                {matched.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ marginBottom: 40 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>
                        These flyers have more inside.
                      </p>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 400, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>
                        Tap directly on information to view.
                      </p>
                    </div>
                    {matched.map(({ flyer, hotspotsByType }, i) => (
                      <div key={flyer.id} className="stagger-item" style={{ animationDelay: `${i * 0.06}s`, background: "#1c1c1e", borderRadius: 32, overflow: "hidden", border: "2px solid #d4d4d4" }}>
                        <button
                          onClick={() => { setPreviewInitialSearch(""); setPreview(flyer); }}
                          style={{
                            display: "flex", alignItems: "center", gap: 14,
                            padding: "14px 16px", width: "100%",
                            background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ flexShrink: 0, width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.15)" }}>
                            {flyer.image_url
                              ? <img src={flyer.image_url} alt={flyer.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>{flyer.title.charAt(0)}</div>
                            }
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {flyer.entity && <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>{flyer.entity}</p>}
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#fff", fontFamily: "var(--font-sans)", lineHeight: 1.4 }}>{flyer.title}</p>
                          </div>
                        </button>
                        {typeOrder.filter(t => hotspotsByType[t]).map(type => (
                          <div key={type}>
                            <div style={{ padding: "8px 16px 4px", display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 18, height: 18, borderRadius: "50%", background: hotspotMeta[type].bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {hotspotMeta[type].icon}
                              </div>
                              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-sans)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{hotspotMeta[type].label}</p>
                            </div>
                            {hotspotsByType[type]!.map((h, hi) => (
                              <button
                                key={hi}
                                onClick={() => { setPreviewInitialSearch(h.label || h.value); setPreview(flyer); }}
                                style={{
                                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                                  padding: "6px 16px 6px 40px", width: "100%",
                                  background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
                                  transition: "background 0.15s",
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                              >
                                {h.label && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)" }}>{h.label}</p>}
                                <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-sans)" }}>{h.value}</p>
                              </button>
                            ))}
                            <div style={{ height: 6 }} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* App Store layout — shown when no search or filters active */}
          {!loading && !showGrouped && (
            <div key={gridKey} style={{ opacity: searchOpen ? 0 : 1, pointerEvents: searchOpen ? "none" : "auto", transition: "opacity 0.2s ease" }}>

              {/* Featured */}
              {flyers.length > 0 && (
                <FeaturedCard
                  flyers={flyers.slice(0, 5)}
                  animationDelay={0}
                  onPreview={f => { setPreviewInitialSearch(""); setPreview(f); }}
                />
              )}

              {/* New arrivals */}
              {flyers.length > 0 && (
                <SectionRow
                  title="Recently Added"
                  dot="#3b82f6"
                  flyers={flyers.slice(0, 5)}
                  animationDelay={0.08}
                  onQuickLook={f => { setPreviewInitialSearch(""); setQuickLook(f); }}
                />
              )}

              {/* All flyers */}
              <div className="stagger-item" style={{ marginBottom: 40, animationDelay: "0.16s" }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", margin: 0, letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>Our Top Picks</p>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, alignItems: "start" }}>
                  {flyers.map((flyer, i) => (
                    <FlyerCard
                      key={flyer.id}
                      flyer={flyer}
                      search=""
                      showEntity={false}
                      onQuickLook={() => { setPreviewInitialSearch(""); setQuickLook(flyer); }}
                      onPreview={() => { setPreviewInitialSearch(""); setPreview(flyer); }}
                      animationDelay={0.16 + i * 0.04}
                    />
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div className="stagger-item" style={{ marginBottom: 40, animationDelay: "0.20s" }}>
                <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", margin: "0 0 12px", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>Quick Links</p>
                <a href="#" style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>Help</a>
                <a href="#" onClick={e => { e.preventDefault(); setShortcutsOpen(true); }} style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>Keyboard Shortcuts</a>
              </div>

              {/* Staff */}
              <div className="stagger-item" style={{ marginBottom: 40, animationDelay: "0.24s" }}>
                <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", margin: "0 0 12px", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>Staff</p>
                <a href="/login?from=/upload" style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>Upload a Flyer</a>
                <a href="/login?from=/admin" style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>Review Flyer Submissions</a>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", paddingTop: 48, paddingBottom: 24 }} />
      </main>

      {/* Filter tap-outside */}
      {filterOpen && <div onClick={() => setFilterOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />}

      {/* ── Floating top search bar ────────────────────────────────── */}
      <div style={{
        position: "fixed", top: 0,
        left: "max(24px, calc(50% - 240px))",
        right: "max(24px, calc(50% - 240px))",
        zIndex: 50,
        paddingTop: 16, paddingBottom: 12,
        opacity: searchOpen ? 1 : 0,
        pointerEvents: searchOpen ? "auto" : "none",
        transition: "opacity 0.25s ease",
      }}>

        {/* Filter tag panel — opens below bar */}
        {allTags.length > 0 && (
          <>
            {/* Outer wrapper — positions both panel and sidebar */}
            <div style={{
              position: "absolute", top: "calc(100% + 10px)", left: 0, right: 0, zIndex: 50,
              opacity: filterOpen ? 1 : 0,
              transform: filterOpen ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
              pointerEvents: filterOpen ? "auto" : "none",
              transition: "opacity 0.25s ease, transform 0.25s ease",
            }}>

              {/* Panel — fixed header + scrollable body */}
              <div style={{
                background: "rgba(255,255,255,0.82)",
                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                borderRadius: 28,
                border: "1px solid rgba(0,0,0,0.08)",
                boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
                display: "flex", flexDirection: "column",
                maxHeight: 360, overflow: "hidden",
              }}>

                {/* Sticky header: segmented control + clear all */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "12px 14px 10px",
                  flexShrink: 0,
                }}>
                  <div style={{ display: "flex", gap: 4, flex: 1, padding: 3, borderRadius: 99, border: "1.5px solid rgba(0,0,0,0.08)" }}>
                    {(["agency", "topics"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setFilterTab(tab)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 99,
                          border: "none",
                          background: filterTab === tab ? "var(--text)" : "transparent",
                          color: filterTab === tab ? "#fff" : "var(--muted)",
                          fontSize: 12, fontWeight: 500, fontFamily: "var(--font-sans)",
                          cursor: "pointer", transition: "background 0.15s, color 0.15s",
                        }}
                      >{tab === "topics" ? "By Topic" : "By Agency"}</button>
                    ))}
                  </div>
                  {(activeTags.length + activeEntities.length) > 0 && (
                    <button
                      onClick={() => { setActiveTags([]); setActiveEntities([]); setGridKey(k => k + 1); }}
                      style={{
                        flexShrink: 0, borderRadius: 99,
                        border: "1.5px solid #ef4444", background: "transparent",
                        color: "#ef4444", fontSize: 12, fontWeight: 600, lineHeight: 1,
                        fontFamily: "var(--font-sans)", cursor: "pointer",
                        padding: "9px 16px",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >Clear {activeTags.length + activeEntities.length}</button>
                  )}
                </div>

                {/* Scrollable list */}
                <div
                  ref={panelScrollRef}
                  className="tag-panel"
                  style={{ overflowY: "auto", flex: 1, padding: "6px 30px 14px 14px" }}
                >

                {/* Topics list */}
                {filterTab === "topics" && availableLetters.map((letter, letterIdx) => {
                  const letterTags = tagsByLetter[letter];
                  const globalOffset = availableLetters.slice(0, letterIdx).reduce((sum, l) => sum + tagsByLetter[l].length, 0);
                  return (
                    <div key={letter} ref={el => { sectionRefs.current[letter] = el; }}>
                      <p style={{
                        fontSize: 10, fontWeight: 700, color: "var(--muted)",
                        fontFamily: "var(--font-sans)", letterSpacing: "0.08em",
                        textTransform: "uppercase", margin: 0,
                        padding: letterIdx === 0 ? "2px 12px 4px" : "10px 12px 4px",
                      }}>{letter}</p>
                      {letterTags.map((tag, tagIdx) => {
                        const active = activeTags.includes(tag);
                        const count = flyers.filter(f => f.tags?.includes(tag)).length;
                        return (
                          <div
                            key={tag}
                            onClick={() => toggleTag(tag)}
                            style={{
                              display: "flex", alignItems: "center",
                              background: active ? "rgba(34,197,94,0.1)" : "transparent",
                              borderRadius: 20, padding: "10px 12px", marginBottom: 4,
                              cursor: "pointer",
                              border: `1px solid ${active ? "#22c55e" : "transparent"}`,
                              opacity: 0, transform: "translateY(12px)",
                              animation: `ios-fadeInUp 0.35s cubic-bezier(0.28, 0.11, 0.32, 1) ${0.04 + (globalOffset + tagIdx) * 0.02}s forwards`,
                              transition: "background 0.15s, border-color 0.15s",
                            }}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f7f7f8"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(34,197,94,0.1)" : "transparent"; }}
                            onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)"; }}
                            onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                          >
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", margin: 0, fontFamily: "var(--font-sans)", letterSpacing: "-0.2px" }}>{tag}</p>
                              <p style={{ fontSize: 12, color: "var(--muted)", margin: "1px 0 0", fontFamily: "var(--font-sans)" }}>{count} flyer{count !== 1 ? "s" : ""}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Agency list */}
                {filterTab === "agency" && allEntities.map((entity, idx) => {
                  const active = activeEntities.includes(entity);
                  const count = flyers.filter(f => f.entity === entity).length;
                  return (
                    <div
                      key={entity}
                      onClick={() => toggleEntity(entity)}
                      style={{
                        display: "flex", alignItems: "center",
                        background: active ? "rgba(34,197,94,0.1)" : "transparent",
                        borderRadius: 20, padding: "10px 12px", marginBottom: 4,
                        cursor: "pointer",
                        border: `1px solid ${active ? "#22c55e" : "transparent"}`,
                        opacity: 0, transform: "translateY(12px)",
                        animation: `ios-fadeInUp 0.35s cubic-bezier(0.28, 0.11, 0.32, 1) ${0.04 + idx * 0.04}s forwards`,
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#f7f7f8"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = active ? "rgba(34,197,94,0.1)" : "transparent"; }}
                      onMouseDown={e => { (e.currentTarget as HTMLElement).style.transform = "scale(0.97)"; }}
                      onMouseUp={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", margin: 0, fontFamily: "var(--font-sans)", letterSpacing: "-0.2px" }}>{entity}</p>
                        <p style={{ fontSize: 12, color: "var(--muted)", margin: "1px 0 0", fontFamily: "var(--font-sans)" }}>{count} flyer{count !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>

              {/* Alphabet sidebar — Topics only */}
              {filterTab === "topics" && (
                <div style={{
                  position: "absolute", top: 0, bottom: 0, right: 4,
                  width: 20, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  zIndex: 51, pointerEvents: "auto",
                }}>
                  {availableLetters.map(letter => (
                    <button
                      key={letter}
                      onClick={() => scrollToLetter(letter)}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        fontSize: 9, fontWeight: 700, fontFamily: "var(--font-sans)",
                        color: "var(--muted)", padding: "2px 0", lineHeight: 1.3,
                        width: "100%", textAlign: "center", borderRadius: 4,
                        transition: "color 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--muted)"; }}
                    >{letter}</button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Bar row: pill + close button */}
        <div>
          <div style={{
            display: "flex", alignItems: "center",
            background: "rgba(255,255,255,0.75)", borderRadius: 52,
            border: "1px solid rgba(0,0,0,0.08)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}>
            {/* Filter icon button */}
            <button
              onClick={() => setFilterOpen(o => !o)}
              style={{
                flexShrink: 0, padding: "14px 16px 14px 20px",
                background: "transparent",
                border: "none", borderRight: "1px solid rgba(0,0,0,0.08)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "background 0.15s", position: "relative",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 3h14M4 8h8M7 13h2" stroke={activeTags.length > 0 || activeEntities.length > 0 || filterOpen ? "#22c55e" : "var(--muted)"} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {(activeTags.length + activeEntities.length) > 0 && (
                <span style={{
                  position: "absolute", top: 8, right: 8,
                  width: 14, height: 14, borderRadius: "50%",
                  background: "#22c55e", color: "#fff",
                  fontSize: 9, fontWeight: 700, fontFamily: "var(--font-sans)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{activeTags.length + activeEntities.length}</span>
              )}
            </button>

            {/* Search input */}
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search all ${flyers.length} flyers…`}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{
                flex: 1, padding: "14px 20px",
                border: "none", background: "transparent",
                fontSize: 16, fontFamily: "var(--font-sans)", color: "var(--text)",
                outline: "none",
              }}
            />

            {/* Close button */}
            <button
              onClick={() => { setSearchOpen(false); setFilterOpen(false); setSearchInput(""); setActiveTags([]); setActiveEntities([]); setGridKey(k => k + 1); }}
              style={{
                flexShrink: 0, marginRight: 10,
                width: 32, height: 32, borderRadius: "50%",
                border: "1.5px solid #ef4444", background: "transparent",
                color: "#ef4444", fontSize: 14, fontWeight: 600,
                fontFamily: "var(--font-sans)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >✕</button>

          </div>
        </div>
      </div>

      {/* Quick Look overlay */}
      {quickLook && (
        <QuickLook
          flyer={quickLook}
          onClose={() => setQuickLook(null)}
          onExpand={() => { setPreview(quickLook); setQuickLook(null); }}
        />
      )}

      {/* Flyer preview overlay */}
      {preview && (
        <FlyerPreview
          flyer={preview}
          initialSearch={previewInitialSearch}
          onClose={() => { setPreview(null); setPreviewInitialSearch(""); }}
        />
      )}

      {/* Keyboard shortcuts modal */}
      {shortcutsOpen && (
        <div
          onClick={closeShortcuts}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
            animation: shortcutsClosing ? "fadeOut 0.18s ease forwards" : "fadeIn 0.2s ease forwards",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#1c1c1e",
              borderRadius: 28,
              border: "1.5px solid rgba(255,255,255,0.1)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
              width: "100%", maxWidth: 380,
              padding: "28px 28px 24px",
              animation: shortcutsClosing ? "fadeScaleOut 0.18s ease forwards" : "fadeScale 0.22s cubic-bezier(0.34,1.4,0.64,1) forwards",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)", letterSpacing: "-0.02em" }}>
                Keyboard Shortcuts
              </p>
              <button
                onClick={closeShortcuts}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)", border: "none",
                  color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-sans)",
                }}
              >✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {[
                { keys: ["A–Z", "0–9"], description: "Start searching" },
                { keys: ["Esc"], description: "Clear search & close" },
              ].map(({ keys, description }, i, arr) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                  padding: "13px 0",
                  borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.08)" : "none",
                }}>
                  <span style={{ fontSize: 14, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-sans)", fontWeight: 400 }}>
                    {description}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {keys.map(k => (
                      <kbd key={k} style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        padding: "4px 10px", borderRadius: 8,
                        background: "rgba(255,255,255,0.1)",
                        border: "1px solid rgba(255,255,255,0.18)",
                        fontSize: 12, fontWeight: 600, color: "#fff",
                        fontFamily: "var(--font-sans)", letterSpacing: "0.02em",
                      }}>{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ margin: "20px 0 0", fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}>
              Available on desktop. Press Esc or tap outside to close.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

// Tracks URLs that have already been loaded this session — survives remounts
const loadedImageUrls = new Set<string>();

// ── Featured card ─────────────────────────────────────────────────────────────
function FeaturedCard({ flyers, animationDelay = 0, onPreview }: { flyers: Flyer[]; animationDelay?: number; onPreview: (f: Flyer) => void }) {
  const [idx, setIdx] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (flyers.length <= 1) return;
    const t = setInterval(() => {
      setFading(true);
      setTimeout(() => { setIdx(i => (i + 1) % flyers.length); setFading(false); }, 300);
    }, 4500);
    return () => clearInterval(t);
  }, [flyers.length]);

  const flyer = flyers[idx];
  if (!flyer) return null;

  return (
    <div className="stagger-item" style={{ marginBottom: 40, animationDelay: `${animationDelay}s` }}>
      <div
        onClick={() => onPreview(flyer)}
        style={{
          position: "relative", width: "100%", paddingBottom: "52%",
          borderRadius: 24, overflow: "hidden", cursor: "pointer",
          background: "#1c1c1e", border: "2px solid #d4d4d4",
        }}
      >
        {flyer.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flyer.image_url} alt={flyer.title} style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover",
            opacity: fading ? 0 : 1, transition: "opacity 0.3s ease",
          }} />
        )}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.85) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", maskImage: "linear-gradient(to bottom, transparent 50%, black 75%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 50%, black 75%)" }} />
        <div style={{ position: "absolute", top: 14, left: 14, background: "#3b82f6", borderRadius: 99, padding: "4px 10px" }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "var(--font-sans)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Featured</p>
        </div>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "16px 18px 20px", opacity: fading ? 0 : 1, transition: "opacity 0.3s ease" }}>
          {flyer.entity && <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-sans)", letterSpacing: "0.04em" }}>{flyer.entity}</p>}
          <p style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#fff", fontFamily: "var(--font-sans)", letterSpacing: "-0.02em", lineHeight: 1.3 }}>{flyer.title}</p>
        </div>
        {flyers.length > 1 && (
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 5, alignItems: "center" }}>
            {flyers.map((_, i) => (
              <div key={i} style={{
                height: 5, borderRadius: 99,
                width: i === idx ? 16 : 5,
                background: i === idx ? "#fff" : "rgba(255,255,255,0.4)",
                transition: "width 0.3s ease",
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Poster card ───────────────────────────────────────────────────────────────
function PosterCard({ flyer, onQuickLook, animationDelay = 0 }: { flyer: Flyer; onQuickLook: () => void; animationDelay?: number }) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      className="stagger-item"
      onClick={onQuickLook}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        flexShrink: 0, width: 168, height: 224, borderRadius: 30, overflow: "hidden",
        cursor: "pointer", background: "#1c1c1e", border: "2px solid #d4d4d4",
        position: "relative",
        transform: pressed ? "scale(0.97)" : "scale(1)", transition: "transform 0.15s ease",
        animationDelay: `${animationDelay}s`,
      }}
    >
      {flyer.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={flyer.image_url} alt={flyer.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 40, fontWeight: 700, color: "rgba(255,255,255,0.15)", fontFamily: "var(--font-sans)" }}>{flyer.title.charAt(0)}</span>
        </div>
      )}
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.85) 100%)" }} />
      <div style={{ position: "absolute", inset: 0, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", maskImage: "linear-gradient(to bottom, transparent 45%, black 70%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 45%, black 70%)" }} />
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "10px 11px 12px" }}>
        {flyer.entity && <p style={{ margin: "0 0 2px", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-sans)" }}>{flyer.entity}</p>}
        <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "#fff", fontFamily: "var(--font-sans)", lineHeight: 1.35 }}>{flyer.title}</p>
      </div>
    </div>
  );
}

// ── Section row ───────────────────────────────────────────────────────────────
function SectionRow({ title, dot, flyers, onSeeAll, onQuickLook, animationDelay = 0 }: {
  title: string; dot?: string; flyers: Flyer[];
  onSeeAll?: () => void; onQuickLook: (f: Flyer) => void; animationDelay?: number;
}) {
  return (
    <div className="stagger-item" style={{ marginBottom: 40, animationDelay: `${animationDelay}s` }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {dot && <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0, marginBottom: 2 }} />}
          <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>{title}</p>
        </div>
        {onSeeAll && (
          <button onClick={onSeeAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, color: "var(--accent)", fontFamily: "var(--font-sans)", padding: "0 0 3px", flexShrink: 0 }}>
            See All →
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollbarWidth: "none", msOverflowStyle: "none" } as React.CSSProperties}>
        {flyers.map((f, i) => <PosterCard key={f.id} flyer={f} onQuickLook={() => onQuickLook(f)} animationDelay={animationDelay + i * 0.04} />)}
      </div>
    </div>
  );
}

// ── Flyer card ────────────────────────────────────────────────────────────────
function FlyerCard({ flyer, search, showEntity, onQuickLook, onPreview, animationDelay = 0 }: {
  flyer: Flyer;
  search: string;
  showEntity: boolean;
  onQuickLook: (initialSearch?: string) => void;
  onPreview: (initialSearch?: string) => void;
  animationDelay?: number;
}) {
  const [pressed, setPressed] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(() =>
    flyer.image_url ? loadedImageUrls.has(flyer.image_url) : true
  );
  const imgRef = useRef<HTMLImageElement>(null);

  // Catch cached images that won't fire onLoad
  useEffect(() => {
    if (imgRef.current?.complete && flyer.image_url) {
      loadedImageUrls.add(flyer.image_url);
      setImgLoaded(true);
    }
  }, [flyer.image_url]);

  return (
    <div
      className="stagger-item"
      onMouseLeave={() => setPressed(false)}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div
        onClick={() => {
          const q = search.toLowerCase();
          const hasMatch = q && flyer.hotspots?.some(s =>
            s.label?.toLowerCase().includes(q) || s.value.toLowerCase().includes(q)
          );
          if (hasMatch) {
            onPreview(search);
          } else {
            onQuickLook();
          }
        }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#ffffff",
          border: "2px solid #d4d4d4",
          borderRadius: 52,
          padding: "10px 20px 10px 10px",
          cursor: "pointer",
          transform: pressed ? "scale(0.98) translateZ(0)" : "scale(1) translateZ(0)",
          transition: "transform 0.15s ease-out",
        }}
      >
        {/* Circular image */}
        <div
          style={{ position: "relative", flexShrink: 0, width: 64, height: 64, borderRadius: "50%", overflow: "hidden", border: "2px solid #d4d4d4" }}
        >
          {/* Skeleton */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: "var(--border)",
            opacity: imgLoaded ? 0 : 1,
            transition: "opacity 0.4s ease",
          }} />
          {flyer.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={flyer.image_url}
              alt={flyer.title}
              onLoad={() => { if (flyer.image_url) loadedImageUrls.add(flyer.image_url); setImgLoaded(true); }}
              style={{ width: "100%", height: "100%", objectFit: "cover", opacity: imgLoaded ? 1 : 0, transition: "opacity 0.4s ease" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
              <span style={{ fontSize: "2em", fontWeight: 700, color: "var(--accent)", opacity: 0.45, fontFamily: "var(--font-sans)" }}>
                {flyer.title.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Entity + Title + matched contact snippet */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(() => {
            const q = search.toLowerCase();
            const match = q ? flyer.hotspots?.find(s =>
              s.label?.toLowerCase().includes(q) || s.value.toLowerCase().includes(q)
            ) : null;
            const matchCircle: Record<Hotspot["type"], { bg: string; icon: React.ReactNode }> = {
              phone: { bg: "#22c55e", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg> },
              sms: { bg: "#06b6d4", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 2V3z" fill="#fff"/></svg> },
              email: { bg: "rgba(251,191,36,0.18)", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M2 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z" fill="#f97316"/><path d="M2 4l6 5 6-5" stroke="#fff" strokeWidth="1.4" strokeLinecap="round"/></svg> },
              address: { bg: "rgba(59,130,246,0.12)", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#ef4444"/></svg> },
              website: { bg: "rgba(99,102,241,0.1)", icon: <svg width="11" height="11" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="5.5" stroke="#6366f1" strokeWidth="1.2"/><path d="M8 2.5c-1.5 1.5-1.5 9.5 0 11M8 2.5c1.5 1.5 1.5 9.5 0 11" stroke="#6366f1" strokeWidth="1.2"/><path d="M2.5 8h11" stroke="#6366f1" strokeWidth="1.2"/></svg> },
            };
            return (
              <>
                {match ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 500, fontFamily: "var(--font-sans)", color: "var(--text)", lineHeight: 1.3, margin: 0 }}>
                      {flyer.title}
                    </p>
                    <div style={{
                      display: "flex", flexDirection: "column", gap: 1,
                      borderLeft: "2px solid rgba(0,0,0,0.15)",
                      paddingLeft: 8, marginLeft: 2,
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{
                          flexShrink: 0, width: 20, height: 20, borderRadius: "50%",
                          background: matchCircle[match.type].bg,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {matchCircle[match.type].icon}
                        </div>
                        {match.label && (
                          <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>
                            {match.label}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted)", fontFamily: "var(--font-sans)", lineHeight: 1.4 }}>
                        {match.value}
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    {flyer.entity && (
                      <p style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-sans)", color: "var(--muted)", lineHeight: 1.3, margin: 0 }}>
                        {flyer.entity}
                      </p>
                    )}
                    <p style={{ fontSize: 14, fontWeight: 500, fontFamily: "var(--font-sans)", color: "var(--text)", lineHeight: 1.4, margin: 0 }}>
                      {flyer.title}
                    </p>
                  </>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Quick Look ────────────────────────────────────────────────────────────────
function QuickLook({ flyer, onClose, onExpand }: { flyer: Flyer; onClose: () => void; onExpand: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
    const handleKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 280);
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed", inset: 0, zIndex: 90,
        background: open ? "rgba(0,0,0,0.45)" : "rgba(0,0,0,0)",
        backdropFilter: open ? "blur(6px)" : "blur(0px)",
        WebkitBackdropFilter: open ? "blur(6px)" : "blur(0px)",
        transition: "background 0.28s ease, backdrop-filter 0.28s ease",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: "relative",
          width: "100%", maxWidth: 560,
          maxHeight: "85vh",
          background: "var(--surface)",
          borderRadius: 24,
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column",
          transform: open ? "scale(1) translateY(0)" : "scale(0.92) translateY(16px)",
          opacity: open ? 1 : 0,
          transition: "transform 0.32s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.28s ease",
        }}
      >
        {/* Scrollable image — tap to expand to full preview */}
        <div
          onClick={() => { handleClose(); setTimeout(onExpand, 100); }}
          style={{ overflowY: "auto", flex: 1, cursor: "pointer", position: "relative" }}
        >
          {/* Tap to expand hint */}
          <div style={{
            position: "absolute", top: 12, right: 12, zIndex: 10,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
            borderRadius: 99, padding: "5px 10px",
            display: "flex", alignItems: "center", gap: 5,
            pointerEvents: "none",
          }}>
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M10 2h4v4M6 14H2v-4M14 2l-5.5 5.5M2 14l5.5-5.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 500, color: "#fff", fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
              Tap again to expand
            </span>
          </div>
          {flyer.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={flyer.image_url} alt={flyer.title} style={{ width: "100%", display: "block" }} />
          ) : (
            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
              <span style={{ fontSize: 64, fontWeight: 700, color: "var(--accent)", opacity: 0.2, fontFamily: "var(--font-sans)" }}>
                {flyer.title.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FlyerPreview({ flyer, initialSearch = "", onClose }: {
  flyer: Flyer;
  initialSearch?: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(!!initialSearch);
  const [contactSearch, setContactSearch] = useState(initialSearch);
  const [contactFilter, setContactFilter] = useState<"all" | "phone" | "sms" | "email" | "address" | "website">("all");
  const hasHotspots = (flyer.hotspots?.length ?? 0) > 0;

  useEffect(() => {
    requestAnimationFrame(() => setOpen(true));
    const handleKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    setSheetOpen(false);
    setContactSearch("");
    setOpen(false);
    setTimeout(onClose, 300);
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!flyer.image_url) return;
    const res = await fetch(flyer.image_url);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${flyer.title}.${blob.type.split("/")[1] || "jpg"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "#0a0a0a",
      opacity: open ? 1 : 0,
      transition: "opacity 0.3s ease",
    }}>
      {/* Full-screen image */}
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {flyer.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={flyer.image_url} alt={flyer.title} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 120, fontWeight: 700, color: "var(--accent)", opacity: 0.2, fontFamily: "var(--font-sans)" }}>
            {flyer.title.charAt(0)}
          </span>
        )}
      </div>

      {/* Close button — bottom center */}
      <button onClick={handleClose} style={{
        position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 20,
        height: 44, borderRadius: 99, padding: "0 18px 0 14px",
        background: "#ef4444", border: "none",
        color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        opacity: open ? 1 : 0,
        transition: "background 0.15s, opacity 0.35s ease 0.1s",
        whiteSpace: "nowrap",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "#dc2626")}
        onMouseLeave={e => (e.currentTarget.style.background = "#ef4444")}
      >
        <span style={{ fontSize: 20, lineHeight: 1 }}>×</span>
        Close
      </button>

      {/* Panel backdrop — dismisses contacts panel on outside tap */}
      {sheetOpen && (
        <div
          onClick={() => { setSheetOpen(false); setContactSearch(""); }}
          style={{ position: "absolute", inset: 0, zIndex: 9 }}
        />
      )}

      {/* Top bar: pill area */}
      <div style={{
        position: "absolute", top: 20, left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 48px)", maxWidth: 400,
        display: "flex", alignItems: "center", gap: 8,
        opacity: open ? 1 : 0,
        transition: "opacity 0.35s ease 0.1s",
        zIndex: 10,
      }}>
        {/* Pill + floating contacts panel below */}
        <div style={{ flex: 1, minWidth: 0, position: "relative" }}>

          {/* Contacts panel — floats below pill */}
          <div style={{
            position: "absolute", top: "calc(100% + 10px)", left: 0, right: 0,
            background: "rgba(20,20,20,0.85)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            borderRadius: 28,
            border: "2px solid rgba(255,255,255,0.12)",
            overflow: "hidden",
            height: 320,
            display: "flex", flexDirection: "column",
            opacity: sheetOpen ? 1 : 0,
            filter: sheetOpen ? "blur(0px)" : "blur(12px)",
            transform: sheetOpen ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
            pointerEvents: sheetOpen ? "auto" : "none",
            transition: "opacity 0.25s ease, filter 0.25s ease, transform 0.25s ease",
          }}>
            {/* Segmented control */}
            {hasHotspots && (() => {
              const allSegments = [
                { key: "all" as const, label: "All", activeBg: "rgba(255,255,255,0.2)", activeColor: "#fff" },
                { key: "phone" as const, label: "Phones", activeBg: "#22c55e", activeColor: "#fff" },
                { key: "sms" as const, label: "SMS", activeBg: "#06b6d4", activeColor: "#fff" },
                { key: "email" as const, label: "Email", activeBg: "#f97316", activeColor: "#fff" },
                { key: "address" as const, label: "Addresses", activeBg: "#ef4444", activeColor: "#fff" },
                { key: "website" as const, label: "Websites", activeBg: "#3b82f6", activeColor: "#fff" },
              ];
              const segments = allSegments.filter(s => s.key === "all" || flyer.hotspots?.some(h => h.type === s.key));
              return segments.length > 1 ? (
                <div style={{
                  padding: "10px 12px 8px",
                  display: "flex", gap: 6,
                  overflowX: "auto", flexShrink: 0,
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                } as React.CSSProperties}>
                  {segments.map(({ key, label, activeBg, activeColor }) => (
                    <button
                      key={key}
                      onClick={() => setContactFilter(key)}
                      style={{
                        flexShrink: 0, padding: "6px 14px", borderRadius: 99,
                        border: `2px solid ${contactFilter === key ? "transparent" : "rgba(255,255,255,0.15)"}`,
                        background: contactFilter === key ? activeBg : "transparent",
                        color: contactFilter === key ? activeColor : "rgba(255,255,255,0.45)",
                        fontSize: 12, fontWeight: 700, fontFamily: "var(--font-sans)",
                        cursor: "pointer", transition: "background 0.15s, color 0.15s, border-color 0.15s",
                        whiteSpace: "nowrap",
                      }}
                    >{label}</button>
                  ))}
                </div>
              ) : null;
            })()}

            <div style={{ flex: 1, overflowY: "auto" }}>
              {flyer.hotspots?.filter(spot => {
                const q = contactSearch.toLowerCase();
                const matchesSearch = !q || spot.label?.toLowerCase().includes(q) || spot.value.toLowerCase().includes(q);
                const matchesFilter = contactFilter === "all" || spot.type === contactFilter;
                return matchesSearch && matchesFilter;
              }).map((spot, i) => {
                const spotMeta: Record<Hotspot["type"], { bg: string; icon: React.ReactNode; href: string }> = {
                  phone: {
                    bg: "#22c55e",
                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 2A1.5 1.5 0 0 0 2 3.5v.75C2 10.28 5.72 14 11.75 14h.75A1.5 1.5 0 0 0 14 12.5v-1.38a1.5 1.5 0 0 0-1.11-1.45l-1.62-.4a1.5 1.5 0 0 0-1.56.6l-.36.48A6.52 6.52 0 0 1 5.65 6.65l.48-.36a1.5 1.5 0 0 0 .6-1.56l-.4-1.62A1.5 1.5 0 0 0 4.88 2H3.5z" fill="#fff"/></svg>,
                    href: `tel:${spot.value.replace(/\D/g, "")}`,
                  },
                  sms: {
                    bg: "#06b6d4",
                    icon: <FaSms size={16} color="#fff" />,
                    href: `sms:${spot.value.replace(/\D/g, "")}`,
                  },
                  email: {
                    bg: "#f97316",
                    icon: <MdEmail size={16} color="#fff" />,
                    href: `mailto:${spot.value}`,
                  },
                  address: {
                    bg: "rgba(59,130,246,0.12)",
                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5C5.515 1.5 3.5 3.515 3.5 6c0 3.75 4.5 8.5 4.5 8.5s4.5-4.75 4.5-8.5C12.5 3.515 10.485 1.5 8 1.5zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#ef4444"/></svg>,
                    href: `https://maps.apple.com/?q=${encodeURIComponent(spot.value)}`,
                  },
                  website: {
                    bg: "#3b82f6",
                    icon: <FaSafari size={16} color="#fff" />,
                    href: spot.value.startsWith("http") ? spot.value : `https://${spot.value}`,
                  },
                };
                const meta = spotMeta[spot.type];
                return (
                  <a
                    key={i}
                    href={meta.href}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px", textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: meta.bg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {meta.icon}
                    </div>
                    <div>
                      {spot.label && (
                        <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "var(--font-sans)", fontWeight: 500, margin: 0, lineHeight: 1.3 }}>
                          {spot.label}
                        </p>
                      )}
                      <p style={{ fontSize: 15, color: "#fff", fontFamily: "var(--font-sans)", fontWeight: 500, margin: 0, lineHeight: 1.4 }}>
                        {spot.value}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
            <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "6px 0 0" }} />
          </div>

          {/* Pill — search + download */}
          <div style={{
            background: "rgba(20,20,20,0.85)",
            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
            borderRadius: 52,
            border: "2px solid rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center",
            overflow: "hidden",
          }}>
            <input
              type="text"
              placeholder="Search inside this flyer…"
              className="preview-search"
              value={contactSearch}
              onChange={e => {
                setContactSearch(e.target.value);
                if (e.target.value) setSheetOpen(true);
              }}
              onFocus={() => setSheetOpen(true)}
              style={{
                flex: 1, minWidth: 0,
                padding: "14px 20px",
                border: "none", background: "transparent",
                fontSize: 16, fontFamily: "var(--font-sans)", color: "#fff",
                outline: "none",
                cursor: "text",
              }}
            />
            {/* Download button */}
            <button
              onClick={handleDownload}
              style={{
                flexShrink: 0, padding: "14px 18px 14px 14px",
                background: "transparent", border: "none",
                borderLeft: "1px solid rgba(255,255,255,0.18)",
                cursor: "pointer", display: "flex", alignItems: "center",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8M5 7l3 3 3-3M3 13h10" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function PreviewAction({ onClick, label, active = false, tint, children }: {
  onClick: () => void;
  label: string;
  active?: boolean;
  tint?: string;
  children: React.ReactNode;
}) {
  const bg = active ? "var(--accent)" : (tint ?? "var(--bg)");
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 40, height: 40, borderRadius: "50%",
        background: bg,
        color: tint || active ? "#fff" : "var(--text)",
        border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
        cursor: "pointer", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "filter 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.filter = "brightness(0.88)"; }}
      onMouseLeave={e => { e.currentTarget.style.filter = "brightness(1)"; }}
    >
      {children}
    </button>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import type { Flyer, Hotspot } from "@/types/flyer";
import QuickLook from "@/components/QuickLook";
import FlyerPreview from "@/components/FlyerPreview";
import FeaturedCard from "@/components/FeaturedCard";
import SectionRow from "@/components/SectionRow";
import FlyerCard from "@/components/FlyerCard";
import GroupedResults, { type FlyerGroup } from "@/components/GroupedResults";

export default function Home() {
  const [flyers, setFlyers] = useState<Flyer[]>([]);
  const [featuredFlyers, setFeaturedFlyers] = useState<Flyer[]>([]);
  const [topPickFlyers, setTopPickFlyers] = useState<Flyer[]>([]);
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

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
      setFeaturedFlyers(flyerList.filter(f => f.featured));
      setTopPickFlyers(flyerList.filter(f => f.top_pick));

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

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    if (stored) { setDarkMode(stored === "dark"); }
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches) { setDarkMode(true); }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

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
        else if (helpOpen) { setHelpOpen(false); }
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
  }, [filterOpen, searchOpen, shortcutsOpen, helpOpen]);

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
        <div role="status" aria-label="Loading" style={{
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
              color: "rgba(255,255,255,0.75)", margin: "16px 0 0", letterSpacing: "0.01em",
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
              maxHeight: (searchOpen || helpOpen) ? 0 : 120,
              opacity: (searchOpen || helpOpen) ? 0 : 1,
              marginBottom: (searchOpen || helpOpen) ? 0 : 32,
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
                  aria-label="Open search"
                  onClick={() => setSearchOpen(true)}
                  style={{
                    flexShrink: 0,
                    height: 44, borderRadius: 99, padding: "0 16px 0 12px",
                    background: "var(--text)", border: "1.5px solid var(--text)",
                    cursor: "pointer", color: "var(--bg)",
                    display: "flex", alignItems: "center", gap: 6,
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--bg)"; b.style.color = "var(--text)"; }}
                  onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.background = "var(--text)"; b.style.color = "var(--bg)"; }}
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                    <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M14 14l3.5 3.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </svg>
                  <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)" }}>Search</span>
                </button>
              </div>
            </div>
          )}

          {loading && (
            <p style={{ fontSize: 13, color: "var(--muted)", fontFamily: "var(--font-sans)" }}>Loading…</p>
          )}

          {/* Grouped search / filter results */}
          {!loading && showGrouped && (
            <GroupedResults
              flyerGroups={flyerGroups}
              search={search}
              activeEntities={activeEntities}
              onQuickLook={(flyer, initialSearch = "") => { setPreviewInitialSearch(initialSearch); setQuickLook(flyer); }}
              onPreview={(flyer, initialSearch = "") => { setPreviewInitialSearch(initialSearch); setPreview(flyer); }}
            />
          )}

          {/* App Store layout — shown when no search or filters active */}
          {!loading && !showGrouped && (
            <div key={gridKey} style={{ opacity: (searchOpen || helpOpen) ? 0 : 1, pointerEvents: (searchOpen || helpOpen) ? "none" : "auto", transition: "opacity 0.2s ease" }}>

              {/* Featured */}
              {(featuredFlyers.length > 0 || flyers.length > 0) && (
                <FeaturedCard
                  flyers={featuredFlyers.length > 0 ? featuredFlyers : flyers.slice(0, 5)}
                  animationDelay={0}
                  onQuickLook={f => { setPreviewInitialSearch(""); setQuickLook(f); }}
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
                  {(topPickFlyers.length > 0 ? topPickFlyers : flyers.slice(0, 5)).map((flyer, i) => (
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

              {/* Around You */}
              <div className="stagger-item" style={{ marginBottom: 40, animationDelay: "0.20s" }}>
                <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", margin: "0 0 16px", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>Around You</p>
                <a
                  href="/around"
                  style={{ display: "block", textDecoration: "none" }}
                >
                  <div style={{
                    display: "flex", alignItems: "center", gap: 16,
                    background: "var(--surface)", border: "1.5px solid var(--card-border)",
                    borderRadius: 20, padding: "16px 20px",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--text)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "var(--card-border)")}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                      background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" fill="#fff"/>
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--text)", margin: "0 0 2px" }}>
                        Find nearby shelters
                      </p>
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--muted)", margin: 0 }}>
                        Overnight shelters within 2 miles of you
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: "var(--muted)" }}>
                      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </a>
              </div>

              {/* Quick Links */}
              <div className="stagger-item" style={{ marginBottom: 40, animationDelay: "0.24s" }}>
                <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", margin: "0 0 12px", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>Quick Links</p>
                <a href="#" onClick={e => { e.preventDefault(); setHelpOpen(true); }} style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>About</a>
                <a href="#" onClick={e => { e.preventDefault(); setShortcutsOpen(true); }} style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>Keyboard Shortcuts</a>
                <a href="#" onClick={e => { e.preventDefault(); setDarkMode(d => !d); }} style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>{darkMode ? "Light Mode" : "Dark Mode"}</a>
              </div>

              {/* Staff */}
              <div className="stagger-item" style={{ marginBottom: 40, animationDelay: "0.24s" }}>
                <p style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", margin: "0 0 12px", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)" }}>Staff</p>
                <a href="/upload" style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>Upload a Flyer</a>
                <a href="/login?from=/admin" style={{ display: "block", fontSize: 17, fontWeight: 500, color: "#3b82f6", textDecoration: "none", fontFamily: "var(--font-sans)", padding: "6px 0" }}>Admin</a>
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
                background: "var(--bar-bg)",
                backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
                borderRadius: 28,
                border: "1px solid var(--bar-border)",
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
                  <div style={{ display: "flex", gap: 4, flex: 1, padding: 3, borderRadius: 99, border: "1.5px solid var(--bar-border)" }}>
                    {(["agency", "topics"] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setFilterTab(tab)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 99,
                          border: "none",
                          background: filterTab === tab ? "var(--text)" : "transparent",
                          color: filterTab === tab ? "var(--bg)" : "var(--muted)",
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
                        border: "1.5px solid var(--danger)", background: "transparent",
                        color: "var(--danger)", fontSize: 12, fontWeight: 600, lineHeight: 1,
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
                  tabIndex={0}
                  role="region"
                  aria-label="Filters"
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
                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--hover-bg)"; }}
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
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--hover-bg)"; }}
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
            background: "var(--bar-bg)", borderRadius: 52,
            border: "1px solid var(--bar-border)",
            backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}>
            {/* Filter icon button */}
            <button
              aria-label="Open filters"
              onClick={() => setFilterOpen(o => !o)}
              style={{
                flexShrink: 0, padding: "14px 16px 14px 20px",
                background: "transparent",
                border: "none", borderRight: "1px solid var(--bar-border)",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                transition: "background 0.15s", position: "relative",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 3h14M4 8h8M7 13h2" stroke={activeTags.length > 0 || activeEntities.length > 0 || filterOpen ? "#22c55e" : "var(--text)"} strokeWidth="1.5" strokeLinecap="round" />
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
                border: "1.5px solid var(--danger)", background: "transparent",
                color: "var(--danger)", fontSize: 14, fontWeight: 600,
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

      {/* Help overlay */}
      <div role="region" aria-label="About" aria-hidden={!helpOpen} style={{
        position: "fixed", inset: 0, zIndex: 150,
        pointerEvents: helpOpen ? "auto" : "none",
        opacity: helpOpen ? 1 : 0,
        transition: "opacity 0.25s ease",
        background: "var(--bg)",
      }}>
        <div style={{ overflowY: "auto", height: "100%", padding: "88px 24px 100px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <p style={{ margin: "0 0 4px", fontSize: 34, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.03em", fontFamily: "var(--font-sans)", lineHeight: 1.1 }}>
                About
              </p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 400, color: "var(--muted)", letterSpacing: "-0.02em", fontFamily: "var(--font-sans)", lineHeight: 1.3 }}>
                The Story behind STARFlyer
              </p>
            </div>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 400, color: "var(--text)", fontFamily: "var(--font-sans)", lineHeight: 1.6 }}>
              As the STAR team, our goal is to get you to safety <em>and</em>{" "}make sure you have access to information. We noticed that flyers were piling up in our office instead of being in your hands. That&apos;s a problem because it means information is stuck instead of flowing out of our building.
            </p>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 400, color: "var(--text)", fontFamily: "var(--font-sans)", lineHeight: 1.6 }}>
              STARFlyer is our answer. Everything our teams receive, find, or see gets uploaded here. <strong>The result: all our information flows through you.</strong> Every flyer was made with a purpose. We take all that paper and pull out phone numbers, addresses, websites and more, so you can spend less time handling documents and more time getting connected to what you need.
            </p>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 400, color: "var(--text)", fontFamily: "var(--font-sans)", lineHeight: 1.6 }}>
              We&apos;re committed to making this accessible to everyone, and are aligning STARFlyer with WCAG 2.2 accessibility guidelines.
            </p>
          </div>
        </div>
        <CloseButton onClose={() => setHelpOpen(false)} />
      </div>

      {/* Keyboard shortcuts modal */}
      {shortcutsOpen && (
        <div
          role="presentation"
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
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
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

// ── Close button ──────────────────────────────────────────────────────────────
function CloseButton({ onClose, visible = true }: { onClose: () => void; visible?: boolean }) {
  return (
    <button
      onClick={onClose}
      style={{
        position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 20,
        height: 44, borderRadius: 99, padding: "0 18px 0 14px",
        background: "#dc2626", border: "none",
        color: "#fff", fontSize: 14, fontWeight: 600, fontFamily: "var(--font-sans)",
        cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
        boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
        opacity: visible ? 1 : 0,
        transition: "background 0.15s, opacity 0.35s ease 0.1s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={e => (e.currentTarget.style.background = "#991b1b")}
      onMouseLeave={e => (e.currentTarget.style.background = "#dc2626")}
    >
      <span style={{ fontSize: 20, lineHeight: 1 }}>×</span>
      Close
    </button>
  );
}


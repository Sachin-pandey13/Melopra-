import { useState } from "react";
import MobileTopBar from "../components/MobileTopBar";
import HorizontalSection from "../components/HorizontalSection";
import useHomeContent from "../hooks/useHomeContent";

export default function HomeScreen({ allItems = [], actions, library }) {
  const [activeMood, setActiveMood] = useState("Home");

  if (!actions) return null;

  const {
    flowCast,
    trending,
    newReleases,
    smartMixes,
    podcasts,
    loading
  } = useHomeContent({ library, actions });

  // 🧪 Recommended for you (Mix of trending + random interest)
  const recommended = [...trending, ...newReleases].sort(() => 0.5 - Math.random()).slice(0, 8);

  const moodFilters = ["Home", "Energize", "Relax", "Commute", "Workout", "Focus"];

  return (
    <div style={{ paddingBottom: 40, background: "transparent" }}>
      {/* Top Bar Navigation */}
      <MobileTopBar title="Melopra" />

      {/* Filter Pills Layout */}
      <div 
        className="flex gap-3 px-4 py-2 overflow-x-auto hide-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", touchAction: "pan-x" }}
      >
        <style dangerouslySetInnerHTML={{ __html: `.hide-scrollbar::-webkit-scrollbar { display: none; }` }} />
        {moodFilters.map((filter) => (
          <button 
            key={filter}
            onClick={() => setActiveMood(filter)}
            className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 ${
              activeMood === filter 
                ? "bg-[#1DB954] text-white shadow-[0_4px_12px_rgba(29,185,84,0.3)]" 
                : "bg-white/10 text-white/80 border border-white/5 backdrop-blur-md"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* 🚀 Main Discovery Content (Home Tab) */}
      {activeMood === "Home" && (
        <>
          {/* 1. FLOWCAST (Personalized) */}
          {flowCast.length > 0 && (
            <HorizontalSection
              title="FlowCast"
              subtitle="Personalized for you"
              items={flowCast}
              actions={actions}
              type="card"
            />
          )}

          {/* 2. NEW RELEASES */}
          {newReleases.length > 0 && (
            <HorizontalSection
              title="New Releases"
              subtitle="From artists you follow"
              items={newReleases}
              actions={actions}
            />
          )}

          {/* 3. TRENDING */}
          <HorizontalSection
            title="Trending in India"
            items={trending}
            loading={loading && trending.length === 0}
            actions={actions}
          />

          {/* 4. RECOMMENDED FOR YOU */}
          {recommended.length > 0 && (
            <HorizontalSection
              title="Recommended for You"
              subtitle="Fresh picks just for you"
              items={recommended}
              actions={actions}
            />
          )}

          {/* 5. SMART MIXES */}
          <HorizontalSection
            title="Your Daily Mixes"
            subtitle="Curated daily based on your taste"
            items={smartMixes}
            actions={actions}
            type="square"
          />
        </>
      )}

      {/* 🌊 MOOD CATEGORIES (Horizontal Rows based on tab) */}
      {activeMood !== "Home" && (
         <>
            <HorizontalSection
              title={`${activeMood} Radio`}
              subtitle={`Endless queue for ${activeMood.toLowerCase()}`}
              items={trending.slice().reverse()} // Placeholder
              actions={actions}
            />
            <HorizontalSection
              title={`Popular ${activeMood} Playlists`}
              items={smartMixes.slice(0, 2)}
              actions={actions}
              type="square"
            />
         </>
      )}

      {/* 📻 PODCASTS (Always visible) */}
      {podcasts.length > 0 && (
        <HorizontalSection
          title="Trending Podcasts"
          subtitle="Top 10 most viewed in India"
          items={podcasts}
          actions={actions}
        />
      )}
    </div>
  );
}

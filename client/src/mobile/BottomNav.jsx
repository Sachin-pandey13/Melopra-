import { FaHome, FaSearch, FaMusic } from "react-icons/fa";

export default function BottomNav({ activeTab, setActiveTab }) {
  const itemClass = (tab) =>
    `flex flex-col items-center justify-center gap-1 text-xs ${
      activeTab === tab ? "text-white" : "text-white/50"
    }`;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-black/60 backdrop-blur-xl border-t border-white/10 flex justify-around z-50 pb-safe">
      <button 
        onClick={() => setActiveTab("home")} 
        className={`${itemClass("home")} transition-transform duration-200 active:scale-90 w-16 h-full`}
      >
        <FaHome size={22} className="mb-1" />
        Home
      </button>

      <button
        onClick={() => setActiveTab("search")}
        className={`${itemClass("search")} transition-transform duration-200 active:scale-90 w-16 h-full`}
      >
        <FaSearch size={22} className="mb-1" />
        Search
      </button>

      <button
        onClick={() => setActiveTab("library")}
        className={`${itemClass("library")} transition-transform duration-200 active:scale-90 w-16 h-full`}
      >
        <FaMusic size={22} className="mb-1" />
        Library
      </button>
    </div>
  );
}

// src/components/Sidebar.jsx
import React from "react";

const Sidebar = ({ isCollapsed, toggleCollapse, trending, newReleases }) => {
  return (
    <div
      className={`${
        isCollapsed ? "w-[60px]" : "w-[250px]"
      } transition-all duration-500 bg-black text-white p-4 overflow-hidden border-r border-white/10`}
    >
      <button
        onClick={toggleCollapse}
        title={isCollapsed ? "Expand Featured" : "Collapse Featured"}
        className="mb-4 text-white hover:text-purple-300 text-lg"
      >
        {isCollapsed ? "➡" : "⬅"}
      </button>

      {!isCollapsed && (
        <>
          <h2 className="text-purple-400 font-semibold mb-3">🔥 Trending Now</h2>
          <div className="flex overflow-x-auto gap-4 mb-6">
            {trending.map((album) => (
              <img
                key={album.id}
                src={album.image}
                alt={album.title}
                className="w-28 h-28 object-cover rounded-lg flex-shrink-0"
              />
            ))}
          </div>

          <h2 className="text-purple-400 font-semibold mb-3">🆕 New Releases</h2>
          <div className="flex overflow-x-auto gap-4">
            {newReleases.map((album) => (
              <img
                key={album.id}
                src={album.image}
                alt={album.title}
                className="w-28 h-28 object-cover rounded-lg flex-shrink-0"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Sidebar;

import React from "react";
import MeloButton from "./melo/MeloButton"; // ✅ Import Melo button
import MeloOrb from "./melo/MeloOrb";       // ✅ Import Melo orb

const Navbar = () => {
  return (
    <div className="w-full h-16 bg-black/50 backdrop-blur-md border-b border-purple-700 flex items-center justify-between px-6">
      {/* Left section: title (unchanged) */}
      <h2 className="text-lg font-medium text-white">Now Playing</h2>

      {/* Right section: Melo button beside profile (for now just Melo) */}
      <div className="flex items-center gap-4">
        {/* Example profile avatar (replace with your actual user image later) */}
        <img
          src="https://i.imgur.com/4M34hi2.png"
          alt="Profile"
          className="w-10 h-10 rounded-full border border-gray-700"
        />

        {/* Melo Button */}
        <MeloButton />
      </div>

      {/* Floating assistant orb */}
      <MeloOrb />
    </div>
  );
};

export default Navbar;

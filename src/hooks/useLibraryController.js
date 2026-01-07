import { useState, useEffect } from "react";
import {
  fetchFavorites,
  addFavorite,
  removeFavorite,
} from "../utils/FirestoreFavorites";
import {
  fetchPlaylists,
  fetchTracksFromPlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  createPlaylist,
} from "../utils/FirestorePlaylists";

export default function useLibraryController({ currentUser }) {
  /* ---------------- core state ---------------- */
  const [selectedLibraryTab, setSelectedLibraryTab] = useState("Recently Played");

  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);

  const [selectedArtist, setSelectedArtist] = useState(null);

  /* ---------------- recent played ---------------- */
  const [recentPlayed, setRecentPlayed] = useState(
    JSON.parse(localStorage.getItem("melopra_recent_played")) || []
  );

  /* ---------------- playlist modals ---------------- */
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");

  const [pendingAddSong, setPendingAddSong] = useState(null);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);

  /* ================= FAVORITES ================= */

  useEffect(() => {
    if (!currentUser) {
      setFavorites([]);
      return;
    }

    fetchFavorites(currentUser.uid)
      .then(setFavorites)
      .catch(() => setFavorites([]));
  }, [currentUser]);

  const isFavorite = (id) => favorites.some((f) => f.id === id);

  const toggleFavorite = async (song) => {
    if (!currentUser || !song) return;

    if (isFavorite(song.id)) {
      await removeFavorite(currentUser.uid, song.id);
      setFavorites((prev) => prev.filter((f) => f.id !== song.id));
    } else {
      await addFavorite(currentUser.uid, song);
      setFavorites((prev) => [song, ...prev]);
    }
  };

  /* ================= PLAYLISTS ================= */

  useEffect(() => {
    if (!currentUser) {
      setPlaylists([]);
      return;
    }

    fetchPlaylists(currentUser.uid).then(setPlaylists);
  }, [currentUser]);

  const openPlaylist = async (pl) => {
    if (!pl || !currentUser) return;
    setActivePlaylist(pl);
    const tracks = await fetchTracksFromPlaylist(currentUser.uid, pl.id);
    setPlaylistTracks(tracks);
  };

  const closePlaylist = () => {
    setActivePlaylist(null);
    setPlaylistTracks([]);
  };

  const addToPlaylist = (song, playlistId) => {
    if (!currentUser) return;
    return addTrackToPlaylist(currentUser.uid, playlistId, song);
  };

  const removeFromPlaylist = (songId, playlistId) => {
    if (!currentUser) return;
    return removeTrackFromPlaylist(currentUser.uid, playlistId, songId);
  };

  const openCreatePlaylist = () => {
    setShowCreatePlaylistModal(true);
  };

  const closeCreatePlaylist = () => {
    setShowCreatePlaylistModal(false);
    setNewPlaylistName("");
  };

  const createNewPlaylist = async () => {
    if (!currentUser || !newPlaylistName.trim()) return;

    const pl = await createPlaylist(currentUser.uid, newPlaylistName.trim());
    setPlaylists((prev) => [...prev, pl]);
    closeCreatePlaylist();
  };

  /* ================= ADD TO PLAYLIST FLOW ================= */

  const openAddToPlaylist = (song) => {
    setPendingAddSong(song);
    setShowAddToPlaylist(true);
  };

  const closeAddToPlaylist = () => {
    setPendingAddSong(null);
    setShowAddToPlaylist(false);
  };

  /* ================= ARTIST VIEW ================= */

  const openArtist = (artistPack) => {
    if (!artistPack) return;
    setSelectedArtist(artistPack);
  };

  const closeArtist = () => {
    setSelectedArtist(null);
  };

  /* ================= RECENT PLAY ================= */

  const addRecentPlay = (album) => {
    if (!album) return;

    setRecentPlayed((prev) => {
      const next = prev.filter((a) => a.id !== album.id);
      const updated = [{ ...album, playedAt: Date.now() }, ...next].slice(0, 10);

      localStorage.setItem(
        "melopra_recent_played",
        JSON.stringify(updated)
      );

      return updated;
    });
  };

  /* ================= PUBLIC API ================= */

  return {
    /* state */
    selectedLibraryTab,
    recentPlayed,
    favorites,
    playlists,
    activePlaylist,
    playlistTracks,
    selectedArtist,

    showCreatePlaylistModal,
    newPlaylistName,
    pendingAddSong,
    showAddToPlaylist,

    /* actions */
    setSelectedLibraryTab,
    setActivePlaylist,

    isFavorite,
    toggleFavorite,
    addRecentPlay,

    openPlaylist,
    closePlaylist,

    addToPlaylist,
    removeFromPlaylist,

    openCreatePlaylist,
    closeCreatePlaylist,
    setNewPlaylistName,
    createNewPlaylist,

    openAddToPlaylist,
    closeAddToPlaylist,

    openArtist,
    closeArtist,
  };
}

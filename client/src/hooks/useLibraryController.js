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
  deletePlaylist,
} from "../utils/FirestorePlaylists";
import {
  fetchFollowedArtists,
  followArtist,
  unfollowArtist,
} from "../utils/FirestoreFollowedArtists";

export default function useLibraryController({ currentUser }) {
  /* ---------------- core state ---------------- */
  const [selectedLibraryTab, setSelectedLibraryTab] = useState("Recently Played");

  const [favorites, setFavorites] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState([]);

  const [selectedArtist, setSelectedArtist] = useState(null);

  /* ---------------- followed artists ---------------- */
  const [followedArtists, setFollowedArtists] = useState([]);

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

  /* ================= FOLLOWED ARTISTS ================= */

  useEffect(() => {
    if (!currentUser) {
      setFollowedArtists([]);
      return;
    }

    fetchFollowedArtists(currentUser.uid)
      .then(setFollowedArtists)
      .catch(() => setFollowedArtists([]));
  }, [currentUser]);

  const isFollowing = (artistId) =>
    followedArtists.some((a) => a.id === artistId);

  const toggleFollowArtist = async (artist) => {
    if (!currentUser || !artist) return;

    const artistId = artist.id || artist.channelId;
    if (!artistId) {
      console.warn("Cannot follow artist: missing ID", artist);
      return;
    }

    try {
      if (isFollowing(artistId)) {
        await unfollowArtist(currentUser.uid, artistId);
        setFollowedArtists((prev) => prev.filter((a) => a.id !== artistId));
      } else {
        const normalized = await followArtist(currentUser.uid, {
          ...artist,
          id: artistId,
        });
        setFollowedArtists((prev) => [normalized, ...prev]);
      }
    } catch (err) {
      console.error("Failed to toggle follow:", err);
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

  const addToPlaylist = async (song, playlistId) => {
    if (!currentUser) return;
    await addTrackToPlaylist(currentUser.uid, playlistId, song);
    // If we're viewing this playlist, refresh tracks
    if (activePlaylist && activePlaylist.id === playlistId) {
      const tracks = await fetchTracksFromPlaylist(currentUser.uid, playlistId);
      setPlaylistTracks(tracks);
    }
  };

  const removeFromPlaylist = async (songId, playlistId) => {
    if (!currentUser) return;
    await removeTrackFromPlaylist(currentUser.uid, playlistId, songId);
    if (activePlaylist && activePlaylist.id === playlistId) {
      setPlaylistTracks((prev) => prev.filter((t) => t.id !== songId));
    }
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

    const newId = await createPlaylist(currentUser.uid, newPlaylistName.trim());
    // createPlaylist returns just the ID string, so build the object
    const newPl = {
      id: newId,
      name: newPlaylistName.trim(),
      createdAt: new Date(),
    };
    setPlaylists((prev) => [...prev, newPl]);
    closeCreatePlaylist();
    return newPl;
  };

  const removePlaylist = async (playlistId) => {
    if (!currentUser) return;
    try {
      await deletePlaylist(currentUser.uid, playlistId);
      setPlaylists((prev) => prev.filter((p) => p.id !== playlistId));
      if (activePlaylist && activePlaylist.id === playlistId) {
        closePlaylist();
      }
    } catch (err) {
      console.error("Failed to delete playlist:", err);
    }
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
    followedArtists,

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

    isFollowing,
    toggleFollowArtist,

    openPlaylist,
    closePlaylist,

    addToPlaylist,
    removeFromPlaylist,

    openCreatePlaylist,
    closeCreatePlaylist,
    setNewPlaylistName,
    createNewPlaylist,
    removePlaylist,

    openAddToPlaylist,
    closeAddToPlaylist,

    openArtist,
    closeArtist,

    // expose setter so screens can optimistically update
    setPlaylists,
  };
}

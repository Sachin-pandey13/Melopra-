import { FaPlay, FaPause } from 'react-icons/fa'

export default function PlayPauseButton({ isPlaying, onPlayPause }) {
  return (
    <button
      onClick={onPlayPause}
      className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
    >
      {isPlaying ? 'Pause' : 'Play'}
    </button>
  )
}
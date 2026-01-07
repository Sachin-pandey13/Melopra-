// client/src/components/TrackInfo.jsx
import { motion } from 'framer-motion'

export default function TrackInfo() {
  const title = 'Now Playing: Bink’s Sake'
  const artist = 'Artist: Zoro Music Vibe'

  return (
    <motion.div
      className="text-center mt-6 space-y-2 select-none"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    >
      <motion.h2
        className="text-2xl md:text-3xl font-bold tracking-wide text-purple-300 glow-text"
        initial={{ scale: 0.9 }}
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
      >
        {title}
      </motion.h2>

      <motion.p
        className="text-md md:text-lg text-purple-400 font-medium glow-text"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
      >
        {artist}
      </motion.p>
    </motion.div>
  )
}

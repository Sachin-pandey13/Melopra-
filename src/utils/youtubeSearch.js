const YOUTUBE_API_KEY = "AIzaSyD2vhVQaTfF2UDRHxMiinuHDW5tMq69aDs";

export async function searchYouTube(query) {
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(
      query
    )}&maxResults=10&type=video&key=${YOUTUBE_API_KEY}`
  );
  const data = await res.json();

  return data.items.map((item) => ({
    id: `youtube-${item.id.videoId}`,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    audio: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    image: item.snippet.thumbnails.high.url,
    language: "English", // Optional fallback
    video: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    lyrics: [],
  }));
}

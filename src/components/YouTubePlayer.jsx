import YouTube from "react-youtube";

export default function YouTubePlayer({ videoId }) {
  return (
    <div className="youtube-player mt-4">
      <YouTube videoId={videoId} opts={{ width: "100%", height: "300" }} />
    </div>
  );
}

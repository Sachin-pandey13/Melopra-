let loadingPromise = null;

export function loadYouTubeAPI() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }

  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      resolve(window.YT);
    };
  });

  return loadingPromise;
}

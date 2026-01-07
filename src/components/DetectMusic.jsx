// client/src/components/DetectMusic.jsx
import React, { useState, useRef } from "react";

export default function DetectMusic() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  async function startRecord() {
    setStatus("Requesting microphone...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mediaRef.current = mr;
    chunksRef.current = [];

    mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setStatus("Uploading...");
      const fd = new FormData();
      fd.append("demo", blob, "demo.webm");
      try {
        const res = await fetch("http://localhost:4000/api/detect", { method: "POST", body: fd });
        const json = await res.json();
        if (json.matches && json.matches.length) {
          setStatus(`Found: ${json.matches[0].title} — ${json.matches[0].artist}`);
        } else if (json.matches) {
          setStatus("No match found");
        } else {
          setStatus("Error: " + (json.error || "unknown"));
        }
      } catch (err) {
        console.error(err);
        setStatus("Upload/analysis error");
      }
    };

    mr.start();
    setRecording(true);
    setStatus("Recording... (max 12s)");
    setTimeout(() => {
      if (mediaRef.current && mediaRef.current.state === "recording") mediaRef.current.stop();
      setRecording(false);
    }, 12000);
  }

  function stopRecord() {
    if (mediaRef.current && mediaRef.current.state === "recording") {
      mediaRef.current.stop();
    }
    setRecording(false);
  }

  return (
    <div className="p-4 border rounded-md">
      <h3 className="text-lg font-semibold">Detect Music (Demo)</h3>
      <p className="text-sm mb-2">Press Start and play a snippet of the song near your microphone.</p>
      <div className="flex gap-2">
        <button onClick={startRecord} disabled={recording} className="px-3 py-1 bg-blue-600 text-white rounded">Start</button>
        <button onClick={stopRecord} disabled={!recording} className="px-3 py-1 bg-gray-300 rounded">Stop</button>
      </div>
      <div className="mt-3 text-sm">{status}</div>
    </div>
  );
}

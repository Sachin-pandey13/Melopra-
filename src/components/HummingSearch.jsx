// client/src/components/HummingSearch.jsx
import React, { useState, useRef } from "react";

export default function HummingSearch() {
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
      setStatus("Uploading humming clip...");
      const fd = new FormData();
      fd.append("demo", blob, "hum.webm");
      try {
        const res = await fetch("http://localhost:4000/api/humsearch", { method: "POST", body: fd });
        const json = await res.json();
        if (res.status === 501) {
          setStatus("Humming search not implemented on server. See README for setup.");
        } else {
          setStatus("Results: " + JSON.stringify(json).slice(0,200));
        }
      } catch (err) {
        console.error(err);
        setStatus("Upload error");
      }
    };

    mr.start();
    setRecording(true);
    setStatus("Recording humming... (8s max)");
    setTimeout(() => {
      if (mediaRef.current && mediaRef.current.state === "recording") mediaRef.current.stop();
      setRecording(false);
    }, 8000);
  }

  function stopRecord() {
    if (mediaRef.current && mediaRef.current.state === "recording") {
      mediaRef.current.stop();
    }
    setRecording(false);
  }

  return (
    <div className="p-4 border rounded-md">
      <h3 className="text-lg font-semibold">Humming / Whistle Search (Demo)</h3>
      <p className="text-sm mb-2">Hum a short tune and upload. Server needs CLAP + FAISS to work.</p>
      <div className="flex gap-2">
        <button onClick={startRecord} disabled={recording} className="px-3 py-1 bg-indigo-600 text-white rounded">Start</button>
        <button onClick={stopRecord} disabled={!recording} className="px-3 py-1 bg-gray-300 rounded">Stop</button>
      </div>
      <div className="mt-3 text-sm">{status}</div>
    </div>
  );
}

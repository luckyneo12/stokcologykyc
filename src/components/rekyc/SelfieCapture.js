"use client";
import { useEffect, useRef, useState } from "react";
import { Modal, ErrorText, Spinner } from "./ui";

// Live selfie for ReKYC: front camera + location; liveness and the face match with the
// Aadhaar photo are checked on the server (Digio), as in the onboarding portal.
function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Your browser does not support location. Please use a recent browser."));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => reject(new Error("Location is required for the selfie. Please allow location access in your browser and try again.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  });
}

export default function SelfieCapture({ onClose, onSubmit }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch(() => setError("Camera access is required. Please allow camera access in your browser and try again."));
    if (!navigator.mediaDevices) setError("Your browser does not support the camera. Please use a recent browser.");
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const scale = Math.min(1, 960 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.9));
  };

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      const location = await getLocation();
      await onSubmit({ image: photo, location });
      onClose();
    } catch (e) {
      setError(e.message);
      setPhoto(null);
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Live Selfie"
      onClose={onClose}
      footer={
        photo ? (
          <><button className="rk-btn rk-btn-ghost" onClick={() => setPhoto(null)} disabled={busy}>Retake</button><button className="rk-btn" onClick={submit} disabled={busy}>{busy && <Spinner />} {busy ? "Verifying…" : "Submit Selfie"}</button></>
        ) : (
          <><button className="rk-btn rk-btn-ghost" onClick={onClose}>Cancel</button><button className="rk-btn" onClick={capture} disabled={!ready}>Capture</button></>
        )
      }
    >
      <ErrorText>{error}</ErrorText>
      <div className="rk-camera">
        <video ref={videoRef} autoPlay playsInline muted style={photo ? { display: "none" } : undefined} />
        {photo && <img src={photo} alt="Your selfie" />}
        {!photo && <div className="rk-camera-oval" />}
      </div>
      <ul style={{ paddingLeft: 20, margin: "12px 0 0", color: "var(--rk-muted)", fontSize: "0.9em" }}>
        <li>Keep your face inside the oval, look straight at the camera.</li>
        <li>Sit in good light. No cap, mask or dark glasses.</li>
        <li>Only you should be in the frame. Photos of photos or screens are rejected.</li>
      </ul>
    </Modal>
  );
}

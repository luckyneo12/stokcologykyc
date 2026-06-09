"use client";
import { useEffect, useRef, useState } from "react";
import { useKYC } from "@/context/KYCContext";
import { ArrowRightIcon } from "../Icons";
import { initializeDigio, createDigioRequest, fetchDigioRequestResponse } from "@/utils/digio";

export default function SelfieStep() {
  const { nextStep, prevStep, addToast, setApplicationId } = useKYC();
  const [phase, setPhase] = useState("intro"); // intro | processing | done
  const [matchScore, setMatchScore] = useState(null);

  const startVerification = async () => {
    setPhase("processing");

    try {
      const { requestId, customerIdentifier, applicationId } = await createDigioRequest("SELFIE", {});
      if (applicationId) setApplicationId(applicationId);

      const digio = initializeDigio({
        callback: async (response) => {
          if (response.error_code) {
            addToast(`Selfie verification failed: ${response.message}`, "error");
            setPhase("intro");
            return;
          }

          const result = await fetchDigioRequestResponse(requestId, "SELFIE");
          if (result?.success) {
            setMatchScore(result.score || result.faceMatchScore || 0);
          }

          addToast("Selfie verification completed", "success");
          setPhase("done");
          nextStep();
        },
      });

      if (!digio || !requestId) {
        addToast("Unable to initialize selfie verification flow", "error");
        setPhase("intro");
        return;
      }

      digio.submit(requestId, customerIdentifier);
    } catch (error) {
      addToast(error?.message || "Error connecting to selfie verification service", "error");
      setPhase("intro");
    }
  };

  return (
    <div className="container-sm" style={{ paddingTop: "8vh", paddingBottom: "4vh" }}>
      <div className="text-center" style={{ marginBottom: 28 }}>
        <h1 className="text-section" style={{ fontSize: "2rem", marginBottom: 8 }}>Selfie Verification</h1>
        <p className="text-body" style={{ fontWeight: 600 }}>Live face capture for identity verification.</p>
      </div>

      {phase === "intro" && (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <p className="text-body" style={{ marginBottom: 32, fontWeight: 600, color: "var(--text-secondary)" }}>
            We need to capture a live selfie video to verify your identity. Please ensure you are in a well-lit area and not wearing glasses or a hat.
          </p>
          <button className="btn btn-primary" onClick={startVerification} style={{ width: "100%", height: "56px", fontSize: "1.1rem", marginBottom: 16 }}>
            Start Selfie Capture
          </button>
          <button className="btn btn-secondary" onClick={prevStep} style={{ width: "100%", height: "56px" }}>
            Back
          </button>
        </div>
      )}

      {phase === "processing" && (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div className="loader" style={{ margin: "0 auto 24px" }}></div>
          <p className="text-body-bold">Launching Digio Secure Capture...</p>
          <p className="text-body" style={{ fontSize: "0.9rem", color: "#666" }}>
            Please complete the selfie flow in the Digio popup.
          </p>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={() => setPhase("intro")} style={{ padding: "12px 24px" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <h2 className="text-section" style={{ marginBottom: 16 }}>Verification Complete</h2>
          <p className="text-body" style={{ marginBottom: 8 }}>
            Your selfie and liveness check have been successfully verified.
          </p>
          {matchScore !== null && (
            <p style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--wise-primary)", marginBottom: 24 }}>
              Match Confidence: {matchScore}%
            </p>
          )}
          <button className="btn btn-primary" onClick={nextStep} style={{ width: "100%" }}>
            Continue <ArrowRightIcon size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

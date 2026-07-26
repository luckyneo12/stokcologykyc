"use client";
import KYCJourney from "@/components/kyc/KYCJourney";
import { useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { useParams, useRouter } from "next/navigation";

export default function StepPage() {
  const { step } = useParams();
  const router = useRouter();
  const { goToStep, STEPS } = useKYC();

  useEffect(() => {
    if (step) {
      const stepIndex = STEPS.findIndex(s => s.id === step);
      if (stepIndex !== -1) {
        // ONLY allow deep linking if they have a token, otherwise they must start at 0
        const token = sessionStorage.getItem("kycToken") || localStorage.getItem("kycToken") || localStorage.getItem("token");
        if (!token && stepIndex > 0) {
           console.log("[Route] No token found, redirecting to start for OTP");
           router.replace("/");
           return;
        }

        // We don't jump immediately if not synced yet, 
        // but we can allow deep linking for verified sessions
        console.log(`[Route] Navigating to step: ${step} (Index: ${stepIndex})`);
        goToStep(stepIndex);
      }
    }
  }, [step, goToStep, STEPS, router]);

  return <KYCJourney />;
}

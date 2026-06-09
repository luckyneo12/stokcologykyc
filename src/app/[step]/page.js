"use client";
import KYCJourney from "@/components/kyc/KYCJourney";
import { useEffect } from "react";
import { useKYC } from "@/context/KYCContext";
import { useParams } from "next/navigation";

export default function StepPage() {
  const { step } = useParams();
  const { goToStep, STEPS } = useKYC();

  useEffect(() => {
    if (step) {
      const stepIndex = STEPS.findIndex(s => s.id === step);
      if (stepIndex !== -1) {
        // We don't jump immediately if not synced yet, 
        // but we can allow deep linking for verified sessions
        console.log(`[Route] Navigating to step: ${step} (Index: ${stepIndex})`);
        goToStep(stepIndex);
      }
    }
  }, [step, goToStep, STEPS]);

  return <KYCJourney />;
}

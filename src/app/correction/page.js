"use client";
import CorrectionFlow from "@/components/kyc/CorrectionFlow";
import { CorrectionProvider } from "@/context/CorrectionContext";

export default function CorrectionPage() {
  return (
    <CorrectionProvider>
      <CorrectionFlow />
    </CorrectionProvider>
  );
}

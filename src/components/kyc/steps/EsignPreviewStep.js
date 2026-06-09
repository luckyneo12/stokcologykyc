import { useKYC } from "@/context/KYCContext";
import { useState, useEffect } from "react";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import Logo from "../Logo";

export default function EsignPreviewStep() {
  const { identityDetails, personalDetails, selfie, signature, nextStep, prevStep, address, bankDetails, ocrData, applicationId, nomineeDetails, selfieDetails } = useKYC();
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
  
  const getFullUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("data:")) return path;
    return `${API_URL}${path}`;
  };

  const photoUrl = getFullUrl(selfie?.preview || selfieDetails?.preview || ocrData?.selfie_path);
  const sigUrl = getFullUrl(signature?.filePreview || signature?.preview);

  useEffect(() => {
    generatePdf();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, []);

  const generatePdf = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch official PDF (55 pages)
      const response = await fetch("/official_form.pdf");
      if (!response.ok) throw new Error("Official form PDF not found");
      const existingPdfBytes = await response.arrayBuffer();

      // 2. Load into pdf-lib
      const officialPdf = await PDFDocument.load(existingPdfBytes);
      const pdfDoc = await PDFDocument.create();
      
      // Copy all 55 pages
      const copiedPages = await pdfDoc.copyPages(officialPdf, officialPdf.getPageIndices());
      copiedPages.forEach(p => pdfDoc.addPage(p));

      // 3. Add 56th Page (Annexure)
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      page.drawText('KYC SUMMARY ANNEXURE (Page 56)', {
        x: 50, y: height - 50, size: 18, font: boldFont, color: rgb(0, 0, 0)
      });

      let currY = height - 100;
      const drawRow = (label, val) => {
        page.drawText(`${label}:`, { x: 50, y: currY, size: 9, font: boldFont });
        page.drawText(String(val || "Not Provided"), { x: 180, y: currY, size: 9, font: font });
        currY -= 18;
      };

      const drawSection = (title) => {
        currY -= 5;
        page.drawRectangle({ x: 45, y: currY - 4, width: width - 90, height: 16, color: rgb(0.95, 0.95, 1) });
        page.drawText(title, { x: 50, y: currY, size: 9, font: boldFont, color: rgb(0, 0, 0.5) });
        currY -= 20;
      }

      drawSection("PERSONAL & IDENTITY");
      drawRow("Full Name", personalDetails?.fullName || ocrData?.name);
      drawRow("Date of Birth", personalDetails?.dob || ocrData?.dob);
      drawRow("Father Name", personalDetails?.fatherName);
      drawRow("Gender", personalDetails?.gender);
      drawRow("Marital Status", personalDetails?.maritalStatus);
      drawRow("PAN Number", identityDetails?.pan);
      drawRow("Aadhaar Number", identityDetails?.aadhaar);
      
      drawSection("CONTACT & PROFESSIONAL");
      drawRow("Email Address", personalDetails?.email || "Not Provided");
      drawRow("Mobile Number", "Verified via OTP");
      drawRow("Occupation", personalDetails?.occupation);
      drawRow("Annual Income", personalDetails?.annualIncome || personalDetails?.incomeRange);

      drawSection("ADDRESS DETAILS");
      const fullAddr = `${address?.line1 || ""}, ${address?.city || ""}, ${address?.state || ""} - ${address?.pincode || ""}`;
      page.drawText("Permanent Address:", { x: 50, y: currY, size: 9, font: boldFont });
      if (fullAddr.length > 65) {
        page.drawText(fullAddr.substring(0, 65), { x: 180, y: currY, size: 9, font: font });
        currY -= 15;
        page.drawText(fullAddr.substring(65), { x: 180, y: currY, size: 9, font: font });
      } else {
        page.drawText(fullAddr, { x: 180, y: currY, size: 9, font: font });
      }
      currY -= 25;

      drawSection("BANK & NOMINEE");
      drawRow("Bank Name", bankDetails?.bankName);
      drawRow("Account Number", bankDetails?.accountNumber);
      drawRow("IFSC Code", bankDetails?.ifsc);

      const isNomineeOpted = nomineeDetails?.opted === "Yes" || nomineeDetails?.opted === true;
      const nom = nomineeDetails?.nominees?.[0];

      if (isNomineeOpted && nom && nom.name) {
        drawRow("Nominee Name", nom.name);
        drawRow("Relationship", nom.relation);
        drawRow("Nominee DOB", nom.dob);
      } else {
        drawRow("Nominees", "Opted Out / Not Provided");
      }
      
      currY -= 10;

      // Images Helper
      const fetchImage = async (url) => {
        if (!url) return null;
        try {
          const res = await fetch(url);
          return await res.arrayBuffer();
        } catch { return null; }
      };

      if (photoUrl) {
        try {
          const bytes = await fetchImage(photoUrl);
          if (bytes) {
            const isPng = photoUrl.toLowerCase().includes(".png") || photoUrl.startsWith("data:image/png");
            const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
            page.drawImage(img, { x: 50, y: currY - 140, width: 120, height: 120 });
            page.drawText("VERIFIED SELFIE", { x: 50, y: currY - 155, size: 8, font: boldFont });
          }
        } catch (imgErr) {
          console.warn("Selfie embed failed:", imgErr);
          page.drawText("[Selfie Image Incompatible]", { x: 50, y: currY - 75, size: 8, font: font, color: rgb(0.5, 0.5, 0.5) });
        }
      }

      if (sigUrl) {
        try {
          const bytes = await fetchImage(sigUrl);
          if (bytes) {
            const isPng = sigUrl.toLowerCase().includes(".png") || sigUrl.startsWith("data:image/png");
            const img = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
            page.drawImage(img, { x: 350, y: currY - 140, width: 120, height: 60 });
            page.drawText("CUSTOMER SIGNATURE", { x: 350, y: currY - 155, size: 8, font: boldFont });
          }
        } catch (imgErr) {
          console.warn("Signature embed failed:", imgErr);
          page.drawText("[Signature Image Incompatible]", { x: 350, y: currY - 75, size: 8, font: font, color: rgb(0.5, 0.5, 0.5) });
        }
      }

      const pdfData = await pdfDoc.save();
      const blob = new Blob([pdfData], { type: "application/pdf" });
      setPdfUrl(URL.createObjectURL(blob));
      setLoading(false);
    } catch (err) {
      console.error("Preview error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="container-md" style={{ paddingTop: "2vh", paddingBottom: "4vh", maxWidth: "1000px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.5px", color: "var(--text-primary)" }}>Full Application Review</h1>
        <p className="text-body" style={{ color: "var(--text-secondary)", marginTop: "12px", fontWeight: 600 }}>Please review your generated application form before e-signing.</p>
      </div>

      <div className="pdf-container animate-slide-up" style={{ 
        background: "var(--bg-elevated)", 
        borderRadius: "32px", 
        border: "1.5px solid var(--border-color)", 
        overflow: "hidden", 
        minHeight: "70vh", 
        position: "relative",
        boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
      }}>
        {loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", zIndex: 10 }}>
            <div className="loader" style={{ marginBottom: 24, width: "48px", height: "48px", border: "4px solid var(--border-color)", borderTop: "4px solid var(--wise-green)" }}></div>
            <p style={{ fontWeight: 800, color: "var(--text-primary)", fontSize: "1.2rem" }}>Preparing Documents...</p>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "8px", fontWeight: 600 }}>Merging 55 Pages + Annexure</p>
          </div>
        )}

        {error && (
          <div style={{ padding: 60, textAlign: "center", background: "var(--bg-card)", position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: "var(--wise-danger)", fontSize: "3rem", marginBottom: 20 }}>!</div>
            <p style={{ color: "var(--text-primary)", fontWeight: 800, fontSize: "1.2rem" }}>Failed to generate preview</p>
            <p style={{ color: "var(--text-secondary)", marginTop: 8, marginBottom: 32 }}>{error}</p>
            <button 
              onClick={generatePdf} 
              className="btn-primary" 
              style={{ padding: "14px 40px", borderRadius: "16px", fontWeight: 800 }}
            >
              Retry Generation
            </button>
          </div>
        )}

        {pdfUrl && (
          <iframe 
            src={`${pdfUrl}#toolbar=0`} 
            style={{ width: "100%", height: "70vh", border: "none" }} 
            title="KYC Preview" 
          />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 32, maxWidth: "480px", marginLeft: "auto", marginRight: "auto" }}>
        <button 
          onClick={nextStep} 
          className="btn-primary" 
          style={{ height: "60px", borderRadius: "16px", fontSize: "1.1rem", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
        >
          Confirm & Proceed ➔
        </button>
        
        <button 
          onClick={prevStep} 
          className="btn-secondary" 
          style={{ height: "56px", borderRadius: "16px", fontWeight: 700, background: "var(--bg-card)", border: "1.5px solid var(--border-color)", color: "var(--text-secondary)" }}
        >
          Back
        </button>
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect, useRef } from "react";
import { useCorrection } from '@/context/CorrectionContext';

import { getPincodeData, uploadDocument, resolveAssetUrl } from "@/utils/kycApi";
import { maskAadhaarImage } from "@/utils/digio";
import DateInput from "../../DateInput";
import ImageCropper from "@/components/ui/ImageCropper";
import { Eye } from "lucide-react";
import DocumentPreviewModal from "../../DocumentPreviewModal";

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", 
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", 
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh", 
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Lakshadweep", "Puducherry"
];

const createEmptyNominee = () => ({ 
  name: "", email: "", mobile: "", relation: "", dob: "", 
  sameAddress: false, address: "", city: "", state: "", 
  pincode: "", country: "India", proofType: "PAN CARD", proofNumber: "", proofPath: "",
  guardianDob: "", guardianName: "", guardianSameAddress: false, guardianAddress: "", guardianCity: "",
  guardianState: "", guardianCountry: "India", guardianPincode: "",
  guardianMobile: "", guardianEmail: "", guardianRelation: "",
  guardianProofType: "PAN CARD", guardianProofNumber: "", guardianProofPath: ""
});

const CheckIcon = ({ size = 10, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

const UploadIcon = ({ size = 18, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);

const CustomSelect = ({ value, onChange, options, placeholder, error, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="input-field"
        style={{ 
          cursor: disabled ? "not-allowed" : "pointer",
          borderColor: error ? "var(--wise-danger)" : isOpen ? "var(--wise-green)" : "var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: disabled ? 0.6 : 1,
          padding: "0 12px"
        }}
      >
        <span style={{ color: value ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.85rem", fontWeight: 700 }}>
          {value || placeholder}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      
      {isOpen && (
        <div style={{ 
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000, 
          background: "var(--bg-elevated)", border: "1px solid var(--border-color)", 
          borderRadius: "16px", marginTop: "8px", boxShadow: "0 12px 48px rgba(0,0,0,0.12)",
          maxHeight: "240px", overflowY: "auto", padding: "8px"
        }}>
          {options.map((opt) => (
            <div 
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              style={{ 
                padding: "10px 12px", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700,
                background: value === opt ? "var(--wise-green)" : "transparent",
                color: value === opt ? "var(--wise-dark-green)" : "var(--text-primary)",
                transition: "all 0.2s", marginBottom: "2px"
              }}
              onMouseOver={e => { if (value !== opt) e.currentTarget.style.background = "rgba(159, 232, 112, 0.15)"; }}
              onMouseOut={e => { if (value !== opt) e.currentTarget.style.background = "transparent"; }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function CorrectionNomineeStep({ stepId, rejectedStep }) {
  const { applicationData, drafts, saveDraft, nextCorrectionStep, prevCorrectionStep, addToast } = useCorrection();
  const nomineeDetails = applicationData?.nomineeDetails || {};
  const userAddress = applicationData?.address || {};
  const identityDetails = applicationData?.identityDetails || {};
  const personalDetails = applicationData?.personalDetails || {};
  const ocrData = applicationData?.ocrData || {};
  
  const isRejection = true;
  const isNomineeDetailsRejected = rejectedStep?.type === 'module' || stepId === 'nomineeDetails';
  const isProofRejected = stepId.includes('Proof') || stepId.includes('Photo');
  const rejectionReasonText = rejectedStep?.reason || '';

  const initialData = isNomineeDetailsRejected && Array.isArray(drafts[stepId]?.nomineeDetails?.nominees) && drafts[stepId].nomineeDetails.nominees.length > 0
    ? drafts[stepId].nomineeDetails.nominees
    : (Array.isArray(nomineeDetails?.nominees) && nomineeDetails.nominees.length > 0 ? nomineeDetails.nominees : [createEmptyNominee()]);

  const [nominees, setNominees] = useState(initialData);
  const clearNomineesDraft = () => {};
  
  const rejectionCleared = useRef(false);

  // In rejection mode, handle granular clearing of just the rejected documents
  useEffect(() => {
    if (isRejection && !rejectionCleared.current && rejectedStep) {
      rejectionCleared.current = true;
      if (drafts[stepId]?.nomineeDetails?.nominees) return;

      const isModuleRejected = rejectedStep?.stepId === "nomineeDetails" || rejectedStep?.stepId === "nomineeChoice";

      if (isModuleRejected) {
        clearNomineesDraft();
        setNominees([createEmptyNominee()]);
      } else {
        let needsUpdate = false;
        const updatedNominees = JSON.parse(JSON.stringify(nominees));

        for (let i = 0; i < updatedNominees.length; i++) {
          if (rejectedStep?.stepId === `nominee${i + 1}Proof`) {
            updatedNominees[i].proofPath = "";
            needsUpdate = true;
          }
          if (rejectedStep?.stepId === `guardian${i + 1}Proof`) {
            updatedNominees[i].guardianProofPath = "";
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          setNominees(updatedNominees);
        }
      }
    }
  }, [isRejection, rejectedStepsList, nominees, setNominees, drafts[stepId]]);

  
  const ALL_RELATIONS = [
    "Brother", "Daughter", "Father", "Nephew", "Grand-father", "Grand-mother", 
    "Cousin", "Mother", "Son", "Sister", "Spouse", "Friend", "Uncle", "Aunty"
  ];
  
  const calculateAge = (dobString) => {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
  };

  const base64ToFile = (base64, filename) => {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
  };

  const [errors, setErrors] = useState({});
  const [cropModalData, setCropModalData] = useState(null);
  const [previewModalData, setPreviewModalData] = useState(null);

  const addNominee = () => {
    if (nominees.length >= 3) {
      addToast("Maximum 3 nominees allowed", "info");
      return;
    }
    setNominees([...nominees, createEmptyNominee()]);
  };

  const removeNominee = (idx) => {
    if (idx === 0) return;
    const updated = nominees.filter((_, i) => i !== idx);
    setNominees(updated);
    
    const newErrors = {};
    Object.keys(errors).forEach(key => {
      const parts = key.split("-");
      if (parts.length < 2) return;
      const i = parseInt(parts[0]);
      const field = parts.slice(1).join("-");
      
      if (i < idx) {
        newErrors[key] = errors[key];
      } else if (i > idx) {
        newErrors[`${i-1}-${field}`] = errors[key];
      }
    });
    setErrors(newErrors);
  };

  const updateNominee = (idx, field, value) => {
    setNominees(prev => {
      const current = Array.isArray(prev) && prev.length > 0 ? prev : [createEmptyNominee()];
      const updated = [...current];
      let finalValue = value;
      
      const isGuardianField = field.includes("guardian");
      const currentProofType = isGuardianField
        ? (field === "guardianProofType" ? value : (updated[idx].guardianProofType || "PAN CARD"))
        : (field === "proofType" ? value : (updated[idx].proofType || "PAN CARD"));
      
      if ((field === "proofNumber" || field === "guardianProofNumber") && currentProofType === "PAN CARD") {
        finalValue = value.toUpperCase();
      }
      
      updated[idx] = { ...updated[idx], [field]: finalValue };
      
      if (field === "proofType" || field === "guardianProofType") {
        const numField = isGuardianField ? "guardianProofNumber" : "proofNumber";
        const pathField = isGuardianField ? "guardianProofPath" : "proofPath";
        updated[idx][numField] = "";
        updated[idx][pathField] = "";
        
        setErrors(prevErr => {
          const newErrors = { ...prevErr };
          delete newErrors[`${idx}-${numField}`];
          delete newErrors[`${idx}-${pathField}`];
          return newErrors;
        });
      }

      if ((field === "proofNumber" || field === "guardianProofNumber") && finalValue) {
        const userPAN = typeof identityDetails?.pan === "string" ? identityDetails.pan.toUpperCase().trim() : "";
        const userAadhaar = identityDetails?.aadhaar?.trim();
        const val = finalValue.toUpperCase().trim();
        const errKey = `${idx}-${field}`;

        setErrors(prevErr => {
          const newErrors = { ...prevErr };
          
          if ((val === userPAN && userPAN) || (val === userAadhaar && userAadhaar)) {
            newErrors[errKey] = `${isGuardianField ? "Guardian" : "Nominee"} ID cannot be same as yours`;
          } else if (updated.some((n, i) => i !== idx && (n.proofNumber?.toUpperCase()?.trim() === val || n.guardianProofNumber?.toUpperCase()?.trim() === val))) {
            newErrors[errKey] = "This ID is already used for another nominee/guardian";
          } else if (!isGuardianField && updated[idx].guardianProofNumber?.toUpperCase()?.trim() === val) {
            newErrors[errKey] = "Nominee ID cannot be the same as their Guardian's ID";
          } else if (isGuardianField && updated[idx].proofNumber?.toUpperCase()?.trim() === val) {
            newErrors[errKey] = "Guardian ID cannot be the same as the Nominee's ID";
          } else {
            const isPAN = currentProofType === "PAN CARD";
            if (isPAN) {
              if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
                newErrors[errKey] = "Invalid PAN format (e.g. ABCDE1234F)";
              } else {
                delete newErrors[errKey];
              }
            } else {
              if (!/^[0-9]*$/.test(val)) {
                newErrors[errKey] = "Invalid Aadhaar (only numbers allowed)";
              } else if (val.length !== 4) {
                newErrors[errKey] = "Please enter the last 4 digits of Aadhaar";
              } else {
                delete newErrors[errKey];
              }
            }
          }
          return newErrors;
        });
      } else if ((field === "proofNumber" || field === "guardianProofNumber") && !finalValue) {
        setErrors(prevErr => {
          const newErrors = { ...prevErr };
          delete newErrors[`${idx}-${field}`];
          return newErrors;
        });
      }

      if (field === "mobile" || field === "guardianMobile") {
        const errKey = `${idx}-${field}`;
        setErrors(prevErr => {
          const newErrors = { ...prevErr };
          if (finalValue && !/^[0-9]*$/.test(finalValue)) {
            newErrors[errKey] = "Numbers only allowed";
          } else if (finalValue && finalValue.length > 10) {
            newErrors[errKey] = "Mobile number should not be more than 10 digits";
          } else if (finalValue && finalValue.length > 0 && !/^[6-9]/.test(finalValue)) {
            newErrors[errKey] = "Mobile number must start with 6, 7, 8 or 9";
          } else {
            delete newErrors[errKey];
          }
          return newErrors;
        });
      }

      if (field === "email" || field === "guardianEmail") {
        const errKey = `${idx}-${field}`;
        setErrors(prevErr => {
          const newErrors = { ...prevErr };
          if (newErrors[errKey] && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalValue)) {
            delete newErrors[errKey];
          } else if (!finalValue) {
            delete newErrors[errKey];
          }
          return newErrors;
        });
      }

      if (field === "name" || field === "dob") {
        const errKey = `${idx}-nameDob`;
        const updatedName = field === "name" ? finalValue : updated[idx].name;
        const updatedDob = field === "dob" ? finalValue : updated[idx].dob;

        const userName = personalDetails?.fullName || ocrData?.name || "";
        const userDob = personalDetails?.dob || ocrData?.dob || "";

        const normalizeDate = (dateStr) => {
          if (!dateStr) return "";
          const cleanDate = dateStr.split("T")[0].replace(/\//g, "-"); 
          const parts = cleanDate.split("-");
          if (parts.length !== 3) return cleanDate;
          if (parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`;
          }
          return cleanDate;
        };

        const cleanNomName = (updatedName || "").trim().toLowerCase().replace(/\s+/g, ' ');
        const cleanUserName = (userName || "").trim().toLowerCase().replace(/\s+/g, ' ');
        const nomDobNorm = normalizeDate(updatedDob);
        const userDobNorm = normalizeDate(userDob);

        setErrors(prevErr => {
          const newErrors = { ...prevErr };
          if (
            cleanNomName && cleanUserName && nomDobNorm && userDobNorm &&
            cleanNomName === cleanUserName &&
            nomDobNorm === userDobNorm
          ) {
            newErrors[errKey] = "You cannot be your own nominee";
          } else {
            delete newErrors[errKey];
          }
          return newErrors;
        });
      }

      return updated;
    });
  };

  const handlePincodeChange = async (idx, field, val) => {
    const numericVal = val.replace(/\D/g, "");
    updateNominee(idx, field, numericVal);
    
    if (numericVal.length === 6) {
      try {
        const data = await getPincodeData(numericVal);
        if (data && data.success) {
          if (field === "pincode") {
            if (data.city !== "Unknown") updateNominee(idx, "city", data.city);
            if (data.state !== "Unknown") updateNominee(idx, "state", data.state);
            updateNominee(idx, "country", "India");
          } else if (field === "guardianPincode") {
            if (data.city !== "Unknown") updateNominee(idx, "guardianCity", data.city);
            if (data.state !== "Unknown") updateNominee(idx, "guardianState", data.state);
            updateNominee(idx, "guardianCountry", "India");
          }
        }
      } catch (error) {
        console.error("Failed to fetch pincode data:", error);
      }
    }
  };

  const handleBlur = (idx, field, value) => {
    if (field === "mobile" || field === "guardianMobile") {
      const newErrors = { ...errors };
      const errKey = `${idx}-${field}`;
      
      if (value && value.length !== 10 && !newErrors[errKey]) {
        newErrors[errKey] = "Mobile number must be exactly 10 digits";
        setErrors(newErrors);
      }
    }
    if (field === "email" || field === "guardianEmail") {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        setErrors(prevErr => ({ ...prevErr, [`${idx}-${field}`]: "Please enter a valid email address" }));
      }
    }
  };

  const handleFileChange = async (idx, e) => {
    const file = e.target.files[0];
    if (file) {
      const isAadhaar = (nominees[idx].proofType || "PAN CARD") === "AADHAAR CARD";
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (file.type === "application/pdf") {
          if (isAadhaar) addToast("Masking Aadhaar... Please wait", "info");
          let finalImage = reader.result;
          if (isAadhaar) {
            try {
              const result = await maskAadhaarImage(reader.result, "PDF", file.name);
              if (result && result.masked_output) {
                finalImage = `data:application/pdf;base64,${result.masked_output}`;
                addToast("Aadhaar masked securely!", "success");
              }
            } catch (err) {
              console.error("Masking error:", err);
              addToast("Failed to mask Aadhaar securely.", "error");
              return;
            }
          }
          try {
            addToast("Uploading document... Please wait", "info");
            const fileToUpload = isAadhaar ? base64ToFile(finalImage, file.name) : file;
            const uploadResult = await uploadDocument(fileToUpload);
            const updated = [...nominees];
            updated[idx] = { ...updated[idx], proofPath: uploadResult.path };
            setNominees(updated);
            addToast("Proof uploaded successfully", "success");
          } catch (err) {
            console.error("Upload error:", err);
            addToast(err.message || "Failed to upload document", "error");
          }
        } else {
          setCropModalData({ idx, isGuardian: false, imageSrc: reader.result, isAadhaar, fileName: file.name });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = null;
    }
  };

  const handleGuardianFileChange = async (idx, e) => {
    const file = e.target.files[0];
    if (file) {
      const isAadhaar = (nominees[idx].guardianProofType || "PAN CARD") === "AADHAAR CARD";

      const reader = new FileReader();
      reader.onloadend = async () => {
        if (file.type === "application/pdf") {
          if (isAadhaar) addToast("Masking Guardian Aadhaar... Please wait", "info");
          let finalImage = reader.result;
          if (isAadhaar) {
            try {
              const result = await maskAadhaarImage(reader.result, "PDF", file.name);
              if (result && result.masked_output) {
                finalImage = `data:application/pdf;base64,${result.masked_output}`;
                addToast("Guardian Aadhaar masked securely!", "success");
              }
            } catch (err) {
              console.error("Masking error:", err);
              addToast("Failed to mask Aadhaar securely.", "error");
              return;
            }
          }
          try {
            addToast("Uploading guardian document... Please wait", "info");
            const fileToUpload = isAadhaar ? base64ToFile(finalImage, file.name) : file;
            const uploadResult = await uploadDocument(fileToUpload);
            const updated = [...nominees];
            updated[idx] = { ...updated[idx], guardianProofPath: uploadResult.path };
            setNominees(updated);
            addToast("Guardian proof uploaded successfully", "success");
          } catch (err) {
            console.error("Upload error:", err);
            addToast(err.message || "Failed to upload document", "error");
          }
        } else {
          setCropModalData({ idx, isGuardian: true, imageSrc: reader.result, isAadhaar, fileName: file.name });
        }
      };
      reader.readAsDataURL(file);
      e.target.value = null;
    }
  };

  const handleCropComplete = async (croppedBase64) => {
    if (!cropModalData) return;
    const { idx, isGuardian, isAadhaar, fileName } = cropModalData;
    
    let finalImage = croppedBase64;
    
    if (isAadhaar) {
      addToast(`Masking ${isGuardian ? "Guardian " : ""}Aadhaar... Please wait`, "info");
      try {
        const result = await maskAadhaarImage(croppedBase64, "PNG", fileName);
        if (result && result.masked_output) {
          finalImage = `data:image/png;base64,${result.masked_output}`;
          addToast(`${isGuardian ? "Guardian " : ""}Aadhaar masked securely!`, "success");
        }
      } catch (err) {
        console.error("Masking error:", err);
        addToast("Failed to mask Aadhaar securely.", "error");
        setCropModalData(null);
        return;
      }
    }

    try {
      addToast("Uploading document... Please wait", "info");
      const fileToUpload = base64ToFile(finalImage, fileName || "document.png");
      const uploadResult = await uploadDocument(fileToUpload);
      const updated = [...nominees];
      if (isGuardian) {
        updated[idx] = { ...updated[idx], guardianProofPath: uploadResult.path };
      } else {
        updated[idx] = { ...updated[idx], proofPath: uploadResult.path };
      }
      setNominees(updated);
      setCropModalData(null);
      addToast(`${isGuardian ? "Guardian " : ""}Proof uploaded successfully`, "success");
    } catch (err) {
      addToast(err.message || "Failed to upload document", "error");
      setCropModalData(null);
    }
  };

  const validate = () => {
    const newErrors = {};
    let isValid = true;
    
    const userPAN = typeof identityDetails?.pan === "string" ? identityDetails.pan.toUpperCase().trim() : "";
    const userAadhaar = identityDetails?.aadhaar?.trim();

    nominees.forEach((nom, idx) => {
      if (!nom.name?.trim()) { newErrors[`${idx}-name`] = true; isValid = false; }
      if (!nom.relation) { newErrors[`${idx}-relation`] = true; isValid = false; }
      if (!nom.dob) { newErrors[`${idx}-dob`] = true; isValid = false; }
      if (!nom.mobile?.trim() || !/^[6-9][0-9]{9}$/.test(nom.mobile.trim())) { 
        newErrors[`${idx}-mobile`] = "Must be 10 digits starting with 6-9"; isValid = false; 
      }
      if (!nom.address?.trim() && !nom.sameAddress) { newErrors[`${idx}-address`] = true; isValid = false; }
      if (!nom.proofNumber?.trim()) { 
        newErrors[`${idx}-proofNumber`] = "Required"; isValid = false; 
      } else {
        const val = nom.proofNumber.toUpperCase().trim();
        const currentProofType = nom.proofType || "PAN CARD";
        
        if ((val === userPAN && userPAN) || (val === userAadhaar && userAadhaar)) {
          newErrors[`${idx}-proofNumber`] = "Nominee ID cannot be same as yours";
          isValid = false;
        } else if (nominees.some((n, i) => i !== idx && (n.proofNumber?.toUpperCase()?.trim() === val || n.guardianProofNumber?.toUpperCase()?.trim() === val))) {
          newErrors[`${idx}-proofNumber`] = "This ID is already used for another nominee/guardian";
          isValid = false;
        } else if (nom.guardianProofNumber?.toUpperCase()?.trim() === val) {
          newErrors[`${idx}-proofNumber`] = "Nominee ID cannot be the same as their Guardian's ID";
          isValid = false;
        } else if (currentProofType === "PAN CARD") {
          if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
            newErrors[`${idx}-proofNumber`] = "Invalid PAN format";
            isValid = false;
          }
        } else {
          if (!/^[0-9]{4}$/.test(val)) {
            newErrors[`${idx}-proofNumber`] = "Please enter the last 4 digits";
            isValid = false;
          }
        }
      }
      if (!nom.proofPath) { newErrors[`${idx}-proofPath`] = true; isValid = false; }

      const userName = personalDetails?.fullName || ocrData?.name || "";
      const userDob = personalDetails?.dob || ocrData?.dob || "";
      
      const normalizeDate = (dateStr) => {
        if (!dateStr) return "";
        const cleanDate = dateStr.split("T")[0].replace(/\//g, "-"); 
        const parts = cleanDate.split("-");
        if (parts.length !== 3) return cleanDate;
        if (parts[0].length === 2 && parts[2].length === 4) {
          return `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        return cleanDate;
      };

      const cleanNomName = (nom.name || "").trim().toLowerCase().replace(/\s+/g, ' ');
      const cleanUserName = (userName || "").trim().toLowerCase().replace(/\s+/g, ' ');
      const nomDobNorm = normalizeDate(nom.dob);
      const userDobNorm = normalizeDate(userDob);

      if (cleanNomName && cleanUserName && nomDobNorm && userDobNorm && cleanNomName === cleanUserName && nomDobNorm === userDobNorm) {
        newErrors[`${idx}-nameDob`] = "You cannot be your own nominee";
        isValid = false;
      }

      if (nom.dob && calculateAge(nom.dob) < 18) {
        if (!nom.guardianName?.trim()) { newErrors[`${idx}-guardianName`] = true; isValid = false; }
        if (!nom.guardianDob) { newErrors[`${idx}-guardianDob`] = true; isValid = false; }
        if (!nom.guardianRelation) { newErrors[`${idx}-guardianRelation`] = true; isValid = false; }
        if (!nom.guardianMobile?.trim() || !/^[6-9][0-9]{9}$/.test(nom.guardianMobile.trim())) { 
          newErrors[`${idx}-guardianMobile`] = "Must be 10 digits starting with 6-9"; isValid = false; 
        }
        if (!nom.guardianEmail?.trim() || !/^\S+@\S+\.\S+$/.test(nom.guardianEmail.trim())) { newErrors[`${idx}-guardianEmail`] = true; isValid = false; }
        if (!nom.guardianAddress?.trim() && !nom.guardianSameAddress) { newErrors[`${idx}-guardianAddress`] = true; isValid = false; }
        if (!nom.guardianCity?.trim()) { newErrors[`${idx}-guardianCity`] = true; isValid = false; }
        if (!nom.guardianState?.trim()) { newErrors[`${idx}-guardianState`] = true; isValid = false; }
        if (!nom.guardianPincode?.trim()) { newErrors[`${idx}-guardianPincode`] = true; isValid = false; }
        if (!nom.guardianProofNumber?.trim()) { 
          newErrors[`${idx}-guardianProofNumber`] = "Required"; isValid = false; 
        } else {
          const val = nom.guardianProofNumber.toUpperCase().trim();
          const currentGuardianProofType = nom.guardianProofType || "PAN CARD";
          
          if ((val === userPAN && userPAN) || (val === userAadhaar && userAadhaar)) {
            newErrors[`${idx}-guardianProofNumber`] = "Guardian ID cannot be same as yours";
            isValid = false;
          } else if (nominees.some((n, i) => i !== idx && (n.proofNumber?.toUpperCase()?.trim() === val || n.guardianProofNumber?.toUpperCase()?.trim() === val))) {
            newErrors[`${idx}-guardianProofNumber`] = "This ID is already used for another nominee/guardian";
            isValid = false;
          } else if (nom.proofNumber?.toUpperCase()?.trim() === val) {
            newErrors[`${idx}-guardianProofNumber`] = "Guardian ID cannot be the same as the Nominee's ID";
            isValid = false;
          } else if (currentGuardianProofType === "PAN CARD") {
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
              newErrors[`${idx}-guardianProofNumber`] = "Invalid PAN format";
              isValid = false;
            }
          } else {
            if (!/^[0-9]{4}$/.test(val)) {
              newErrors[`${idx}-guardianProofNumber`] = "Please enter the last 4 digits";
              isValid = false;
            }
          }
        }
        if (!nom.guardianProofPath) { newErrors[`${idx}-guardianProofPath`] = true; isValid = false; }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleNext = async () => {
    if (!validate()) {
      addToast("Please fill all required fields correctly", "error");
      return;
    }
    const payloadData = { ...nomineeDetails, numberOfNominees: nominees.length.toString(), nominees };
    const success = await saveDraft(stepId, { nomineeDetails: payloadData });
    if (success) nextCorrectionStep();
  };

  return (
    <div className="container-lg" style={{ paddingTop: "2vh", paddingBottom: "4vh", maxWidth: "800px", margin: "0 auto", paddingLeft: "24px", paddingRight: "24px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 48 }}>
        <h1 className="text-section" style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-1px" }}>Add Nominee Details</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "8px", fontWeight: 600 }}>Specify who should receive the assets in your account</p>
      </div>

      <div className="animate-slide-up">
        {isNomineeRejected && (
          <div style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1.5px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "16px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            gap: "14px"
          }}>
            <span style={{ fontSize: "1.4rem" }}>⚠️</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, color: "var(--wise-danger)", fontSize: "0.95rem" }}>
                Nominee Details Rejected
              </p>
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.4 }}>
                {nomineeRejectionReason ? `Reason: ${nomineeRejectionReason}. ` : ""}Please fill in your correct nominee details and proceed.
              </p>
            </div>
          </div>
        )}
        
        {nominees.map((nom, idx) => (
          <div key={idx} style={{ 
            marginBottom: idx === nominees.length - 1 ? 40 : 80,
            paddingBottom: idx === nominees.length - 1 ? 0 : 40,
            borderBottom: idx === nominees.length - 1 ? "none" : "1.5px dashed var(--border-color)"
          }}>
            <div style={{ marginBottom: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid var(--border-color)", paddingBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-primary)" }}>
                <div style={{ width: 40, height: 40, borderRadius: "12px", background: "var(--wise-green)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--wise-dark-green)" }}>
                  <UserIcon />
                </div>
                <div>
                  <h3 style={{ fontSize: "1.2rem", fontWeight: 800 }}>{idx === 0 ? "First" : idx === 1 ? "Second" : "Third"} Nominee</h3>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 600 }}>Enter the legal information for your nominee</p>
                </div>
              </div>
              {idx > 0 && (
                <button 
                  onClick={() => removeNominee(idx)}
                  style={{ 
                    padding: "8px 16px", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 700,
                    border: "1.5px solid var(--wise-danger)", color: "var(--wise-danger)", background: "transparent",
                    cursor: "pointer", transition: "all 0.2s"
                  }}
                >
                  Remove Nominee
                </button>
              )}
            </div>

            <div className="form-grid">
              
              {/* Column 1 */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ height: "24px", display: "flex", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Nominee Name <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                  </div>
                  <input 
                    className="input-field" 
                    placeholder="Enter your name" 
                    value={nom.name || ""} 
                    onChange={e => updateNominee(idx, "name", e.target.value)}
                    style={{ borderColor: errors[`${idx}-name`] || errors[`${idx}-nameDob`] ? "var(--wise-danger)" : "var(--border-color)" }}
                  />
                  {errors[`${idx}-nameDob`] && (
                    <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{errors[`${idx}-nameDob`]}</p>
                  )}
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Nominee Email</label>
                  <input 
                    type="email"
                    className="input-field" 
                    placeholder="Enter nominee email" 
                    value={nom.email || ""} 
                    onChange={e => updateNominee(idx, "email", e.target.value)}
                    onBlur={e => handleBlur(idx, "email", e.target.value)}
                    style={{ borderColor: errors[`${idx}-email`] ? "var(--wise-danger)" : "var(--border-color)" }}
                  />
                  {errors[`${idx}-email`] && (
                    <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{errors[`${idx}-email`]}</p>
                  )}
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Nominee Mobile <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                  <input 
                    type="tel"
                    name={`nomineeMobile_${idx}`}
                    autoComplete="tel"
                    className="input-field" 
                    placeholder="Enter nominee mobile number" 
                    value={nom.mobile || ""} 
                    onChange={e => updateNominee(idx, "mobile", e.target.value)}
                    onBlur={e => handleBlur(idx, "mobile", e.target.value)}
                    style={{ borderColor: errors[`${idx}-mobile`] ? "var(--wise-danger)" : "var(--border-color)" }}
                  />
                  {errors[`${idx}-mobile`] && typeof errors[`${idx}-mobile`] === "string" && (
                    <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{errors[`${idx}-mobile`]}</p>
                  )}
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Relation {!nom.relation ? <span style={{ color: "var(--wise-danger)" }}>*</span> : ""}</label>
                  <CustomSelect 
                    value={nom.relation}
                    placeholder="Choose relation"
                    options={ALL_RELATIONS.filter(rel => {
                      const uniqueRelations = ["Mother", "Father", "Grand-father", "Grand-mother"];
                      if (uniqueRelations.includes(rel)) {
                        const selectedByOthers = nominees.filter((n, i) => i !== idx).map(n => n.relation);
                        return !selectedByOthers.includes(rel) || rel === nom.relation;
                      }
                      return true;
                    })}
                    onChange={val => updateNominee(idx, "relation", val)}
                    error={errors[`${idx}-relation`]}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Nominee Date of Birth <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                  <DateInput 
                    className="input-field" 
                    value={nom.dob || ""} 
                    onChange={e => updateNominee(idx, "dob", e.target.value)}
                    style={{ borderColor: errors[`${idx}-dob`] || errors[`${idx}-nameDob`] ? "var(--wise-danger)" : "var(--border-color)", padding: "0 12px" }}
                  />
                </div>
              </div>

              {/* Column 2 */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ height: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-primary)", fontWeight: 700, opacity: 0.85 }}>
                      Nominee Address {!nom.sameAddress && <span style={{ color: "var(--wise-danger)" }}>*</span>}
                    </label>
                    <div 
                      style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "6px" }}
                      onClick={() => {
                        const newVal = !nom.sameAddress;
                        if (newVal) {
                          const updated = [...nominees];
                          updated[idx] = {
                            ...updated[idx], sameAddress: true,
                            address: [userAddress?.line1, userAddress?.line2].filter(Boolean).join(", "),
                            city: userAddress?.city || "", state: userAddress?.state || "", pincode: userAddress?.pincode || "", country: userAddress?.country || "India"
                          };
                          setNominees(updated);
                        } else {
                          const updated = [...nominees];
                          updated[idx] = {
                            ...updated[idx], sameAddress: false,
                            address: "", city: "", state: "", pincode: "", country: ""
                          };
                          setNominees(updated);
                        }
                      }}
                    >
                      <div style={{ 
                        width: "16px", height: "16px", borderRadius: "4px", border: "1.5px solid var(--wise-green)", 
                        background: nom.sameAddress ? "var(--wise-green)" : "transparent", 
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {nom.sameAddress && <CheckIcon size={10} color="white" />}
                      </div>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>Same as mine</span>
                    </div>
                  </div>

                  <input 
                    className="input-field" 
                    placeholder="Address Line" 
                    value={nom.address || ""} 
                    onChange={e => updateNominee(idx, "address", e.target.value)} 
                    disabled={nom.sameAddress}
                    style={{ 
                      borderColor: errors[`${idx}-address`] ? "var(--wise-danger)" : "var(--border-color)"
                    }}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Pincode</label>
                  <input 
                    className="input-field" 
                    placeholder="Pincode" 
                    value={nom.pincode || ""} 
                    onChange={e => handlePincodeChange(idx, "pincode", e.target.value)} 
                    maxLength={6}
                    disabled={nom.sameAddress}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>City</label>
                  <input 
                    className="input-field" 
                    placeholder="City" 
                    value={nom.city || ""} 
                    onChange={e => updateNominee(idx, "city", e.target.value)} 
                    disabled={nom.sameAddress}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>State</label>
                  <CustomSelect 
                    value={nom.state}
                    placeholder="-- Select State --"
                    options={INDIAN_STATES}
                    onChange={val => updateNominee(idx, "state", val)}
                    disabled={nom.sameAddress}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Country</label>
                  <input 
                    className="input-field" 
                    placeholder="Country" 
                    value={nom.country || "India"} 
                    onChange={e => updateNominee(idx, "country", e.target.value)} 
                    disabled={nom.sameAddress}
                  />
                </div>
              </div>

              {/* Column 3 */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ height: "24px", display: "flex", alignItems: "center", marginBottom: "8px" }}>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Select Nominee Proof Type <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                  </div>
                  <CustomSelect 
                    value={nom.proofType || "PAN CARD"}
                    options={["PAN CARD", "AADHAAR CARD"]}
                    onChange={val => updateNominee(idx, "proofType", val)}
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Enter {(nom.proofType || "PAN CARD") === "PAN CARD" ? "PAN" : "Aadhaar"} Number <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                  {(nom.proofType || "PAN CARD") === "PAN CARD" ? (
                    <input 
                      className="input-field" 
                      placeholder="Enter Nominee PAN number" 
                      value={nom.proofNumber || ""} 
                      onChange={e => updateNominee(idx, "proofNumber", e.target.value)}
                      style={{ borderColor: errors[`${idx}-proofNumber`] ? "var(--wise-danger)" : "var(--border-color)" }}
                    />
                  ) : (
                    <div 
                      className="input-field" 
                      onClick={(e) => {
                        const input = e.currentTarget.querySelector('input');
                        if (input) input.focus();
                      }}
                      style={{ 
                        display: "flex", alignItems: "center", padding: "0 12px", 
                        borderColor: errors[`${idx}-proofNumber`] ? "var(--wise-danger)" : "var(--border-color)",
                        cursor: "text"
                      }}
                    >
                      <span style={{ color: "var(--text-secondary)", marginRight: "8px", letterSpacing: "2px", fontWeight: 700, fontSize: "0.85rem", opacity: 0.7, whiteSpace: "nowrap" }}>XXXX XXXX</span>
                      <input 
                        placeholder="1234" 
                        value={nom.proofNumber || ""} 
                        onChange={e => {
                          const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                          updateNominee(idx, "proofNumber", val);
                        }}
                        style={{ border: "none", background: "transparent", outline: "none", width: "100%", color: "var(--text-primary)", fontWeight: 700, fontSize: "0.85rem", padding: 0 }}
                      />
                    </div>
                  )}
                  {errors[`${idx}-proofNumber`] && typeof errors[`${idx}-proofNumber`] === "string" && (
                    <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{errors[`${idx}-proofNumber`]}</p>
                  )}
                </div>

                <div style={{ marginBottom: "32px" }}>
                  {cropModalData && cropModalData.idx === idx && !cropModalData.isGuardian ? (
                    <ImageCropper 
                      filePreview={cropModalData.imageSrc}
                      setFilePreview={(res) => setCropModalData({ ...cropModalData, imageSrc: res })}
                      cropLabel={`Crop Nominee ${(nom.proofType || "PAN CARD") === "PAN CARD" ? "PAN" : "Aadhaar"}`}
                      onCropApply={(res) => handleCropComplete(res)}
                      onCancel={() => setCropModalData(null)}
                    />
                  ) : (
                    <>
                      <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", height: "48px", border: errors[`${idx}-proofPath`] ? "2px dashed var(--wise-danger)" : "1.2px dashed var(--border-color)", borderRadius: "12px", background: "var(--input-bg)", cursor: "pointer", color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 700 }}>
                        <input type="file" style={{ display: "none" }} onChange={e => handleFileChange(idx, e)} accept="image/*,application/pdf" />
                        <UploadIcon /> <span>Upload Nominee {(nom.proofType || "PAN CARD") === "PAN CARD" ? "PAN Card" : "Aadhaar Card"}</span>
                      </label>
                      {nom.proofPath && (
                        <div style={{ marginTop: "12px", textAlign: "center", padding: "10px", borderRadius: "12px", background: "var(--wise-light-mint)", border: "1px solid var(--wise-green)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                          {nom.proofPath.toLowerCase().endsWith(".pdf") || nom.proofPath.includes("application/pdf") ? (
                            <div style={{ width: "100%", maxWidth: "200px", height: "100px", background: "var(--bg-elevated)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>PDF Document</span>
                            </div>
                          ) : (
                            <img src={resolveAssetUrl(nom.proofPath)} alt="Nominee Proof" style={{ maxWidth: "200px", maxHeight: "150px", borderRadius: "8px", objectFit: "contain", border: "1px solid var(--border-color)" }} />
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <p style={{ fontSize: "0.7rem", color: "var(--wise-positive)", fontWeight: 800, margin: 0, whiteSpace: "nowrap" }}>✓ Nominee {(nom.proofType || "PAN CARD") === "PAN CARD" ? "PAN" : "Aadhaar"} Uploaded</p>
                            <button onClick={() => setPreviewModalData({ url: resolveAssetUrl(nom.proofPath) })} style={{ background: "var(--bg-secondary)", border: "none", padding: "6px", borderRadius: "8px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>
                              <Eye size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Guardian Section for Minor */}
            {nom.dob && calculateAge(nom.dob) < 18 && (
              <div className="animate-slide-up" style={{ marginTop: "32px", padding: "32px", borderRadius: "24px", border: "1.5px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                <div style={{ marginBottom: "24px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1.5px solid var(--border-color)", paddingBottom: "16px" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "8px", background: "var(--wise-dark-green)", display: "flex", alignItems: "center", justifyContent: "center", color: "white" }}>
                    <UserIcon />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: 800 }}>Guardian Details (Minor Nominee)</h3>
                    <p style={{ fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 600 }}>Please provide legal guardian information</p>
                  </div>
                </div>
                <div className="form-grid">
                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian Name <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <input 
                      className="input-field" 
                      placeholder="Name" 
                      value={nom.guardianName || ""} 
                      onChange={e => updateNominee(idx, "guardianName", e.target.value)} 
                      style={{ borderColor: errors[`${idx}-guardianName`] ? "var(--wise-danger)" : "var(--border-color)" }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian Relation <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <CustomSelect 
                      value={nom.guardianRelation}
                      placeholder="--Select--"
                      options={ALL_RELATIONS}
                      onChange={val => updateNominee(idx, "guardianRelation", val)}
                      error={errors[`${idx}-guardianRelation`]}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian DOB <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <DateInput 
                      className="input-field" 
                      value={nom.guardianDob || ""} 
                      onChange={e => updateNominee(idx, "guardianDob", e.target.value)} 
                      style={{ borderColor: errors[`${idx}-guardianDob`] ? "var(--wise-danger)" : "var(--border-color)", padding: "0 12px" }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian Mobile <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <input 
                      type="tel"
                      name={`guardianMobile_${idx}`}
                      autoComplete="tel"
                      className="input-field" 
                      placeholder="Mobile" 
                      value={nom.guardianMobile || ""} 
                      onChange={e => updateNominee(idx, "guardianMobile", e.target.value)} 
                      onBlur={e => handleBlur(idx, "guardianMobile", e.target.value)}
                      style={{ borderColor: errors[`${idx}-guardianMobile`] ? "var(--wise-danger)" : "var(--border-color)" }}
                    />
                    {errors[`${idx}-guardianMobile`] && typeof errors[`${idx}-guardianMobile`] === "string" && (
                      <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{errors[`${idx}-guardianMobile`]}</p>
                    )}
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian Email <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <input 
                      type="email"
                      className="input-field" 
                      placeholder="Email" 
                      value={nom.guardianEmail || ""} 
                      onChange={e => updateNominee(idx, "guardianEmail", e.target.value)} 
                      onBlur={e => handleBlur(idx, "guardianEmail", e.target.value)}
                      style={{ borderColor: errors[`${idx}-guardianEmail`] ? "var(--wise-danger)" : "var(--border-color)" }}
                    />
                    {errors[`${idx}-guardianEmail`] && (
                      <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{errors[`${idx}-guardianEmail`]}</p>
                    )}
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <label style={{ fontSize: "0.72rem", color: "var(--text-primary)", fontWeight: 700, opacity: 0.85 }}>
                        Guardian Address {!nom.guardianSameAddress && <span style={{ color: "var(--wise-danger)" }}>*</span>}
                      </label>
                      <div 
                        style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "6px" }}
                        onClick={() => {
                          const newVal = !nom.guardianSameAddress;
                          if (newVal) {
                            const updated = [...nominees];
                            updated[idx] = {
                              ...updated[idx], guardianSameAddress: true,
                              guardianAddress: [userAddress?.line1, userAddress?.line2].filter(Boolean).join(", "),
                              guardianCity: userAddress?.city || "", guardianState: userAddress?.state || "", guardianPincode: userAddress?.pincode || "", guardianCountry: userAddress?.country || "India"
                            };
                            setNominees(updated);
                          } else {
                            const updated = [...nominees];
                            updated[idx] = {
                              ...updated[idx], guardianSameAddress: false,
                              guardianAddress: "", guardianCity: "", guardianState: "", guardianPincode: "", guardianCountry: ""
                            };
                            setNominees(updated);
                          }
                        }}
                      >
                        <div style={{ 
                          width: "16px", height: "16px", borderRadius: "4px", border: "1.5px solid var(--wise-green)", 
                          background: nom.guardianSameAddress ? "var(--wise-green)" : "transparent", 
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}>
                          {nom.guardianSameAddress && <CheckIcon size={10} color="white" />}
                        </div>
                        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-secondary)" }}>Same as mine</span>
                      </div>
                    </div>

                    <input 
                      className="input-field" 
                      placeholder="Address" 
                      value={nom.guardianAddress || ""} 
                      onChange={e => updateNominee(idx, "guardianAddress", e.target.value)} 
                      disabled={nom.guardianSameAddress}
                      style={{ borderColor: errors[`${idx}-guardianAddress`] ? "var(--wise-danger)" : "var(--border-color)" }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian Pincode <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <input 
                      className="input-field" 
                      placeholder="Pincode" 
                      value={nom.guardianPincode || ""} 
                      onChange={e => handlePincodeChange(idx, "guardianPincode", e.target.value)} 
                      maxLength={6}
                      disabled={nom.guardianSameAddress}
                      style={{ borderColor: errors[`${idx}-guardianPincode`] ? "var(--wise-danger)" : "var(--border-color)" }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian City <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <input 
                      className="input-field" 
                      placeholder="City" 
                      value={nom.guardianCity || ""} 
                      onChange={e => updateNominee(idx, "guardianCity", e.target.value)} 
                      disabled={nom.guardianSameAddress}
                      style={{ borderColor: errors[`${idx}-guardianCity`] ? "var(--wise-danger)" : "var(--border-color)" }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian State <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <CustomSelect 
                      value={nom.guardianState}
                      placeholder="--Select State--"
                      options={INDIAN_STATES}
                      onChange={val => updateNominee(idx, "guardianState", val)}
                      disabled={nom.guardianSameAddress}
                      error={errors[`${idx}-guardianState`]}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Guardian Country <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <input 
                      className="input-field" 
                      placeholder="Country" 
                      value={nom.guardianCountry || "India"} 
                      onChange={e => updateNominee(idx, "guardianCountry", e.target.value)} 
                      disabled={nom.guardianSameAddress}
                      style={{ borderColor: errors[`${idx}-guardianCountry`] ? "var(--wise-danger)" : "var(--border-color)" }}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Select Guardian Proof Type <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    <CustomSelect 
                      value={nom.guardianProofType || "PAN CARD"}
                      options={["PAN CARD", "AADHAAR CARD"]}
                      onChange={val => updateNominee(idx, "guardianProofType", val)}
                    />
                  </div>

                  <div style={{ marginBottom: "16px" }}>
                    <label style={{ display: "block", marginBottom: "4px", fontSize: "0.72rem", fontWeight: 700, opacity: 0.85 }}>Enter {(nom.guardianProofType || "PAN CARD") === "AADHAAR CARD" ? "Aadhaar" : "PAN"} Number <span style={{ color: "var(--wise-danger)" }}>*</span></label>
                    {(nom.guardianProofType || "PAN CARD") === "PAN CARD" ? (
                      <input 
                        className="input-field" 
                        placeholder="Enter PAN Number" 
                        value={nom.guardianProofNumber || ""} 
                        onChange={e => updateNominee(idx, "guardianProofNumber", e.target.value)} 
                        style={{ borderColor: errors[`${idx}-guardianProofNumber`] ? "var(--wise-danger)" : "var(--border-color)" }}
                      />
                    ) : (
                      <div 
                        className="input-field" 
                        onClick={(e) => {
                          const input = e.currentTarget.querySelector('input');
                          if (input) input.focus();
                        }}
                        style={{ 
                          display: "flex", alignItems: "center", padding: "0 12px", 
                          borderColor: errors[`${idx}-guardianProofNumber`] ? "var(--wise-danger)" : "var(--border-color)",
                          cursor: "text"
                        }}
                      >
                        <span style={{ color: "var(--text-secondary)", marginRight: "8px", letterSpacing: "2px", fontWeight: 700, fontSize: "0.85rem", opacity: 0.7, whiteSpace: "nowrap" }}>XXXX XXXX</span>
                        <input 
                          placeholder="1234" 
                          value={nom.guardianProofNumber || ""} 
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 4);
                            updateNominee(idx, "guardianProofNumber", val);
                          }}
                          style={{ border: "none", background: "transparent", outline: "none", width: "100%", color: "var(--text-primary)", fontWeight: 700, fontSize: "0.85rem", padding: 0 }}
                        />
                      </div>
                    )}
                    {errors[`${idx}-guardianProofNumber`] && typeof errors[`${idx}-guardianProofNumber`] === "string" && (
                      <p style={{ fontSize: "0.7rem", color: "var(--wise-danger)", marginTop: "4px", fontWeight: 700 }}>{errors[`${idx}-guardianProofNumber`]}</p>
                    )}
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ marginBottom: "32px" }}>
                    {cropModalData && cropModalData.idx === idx && cropModalData.isGuardian ? (
                      <ImageCropper 
                        filePreview={cropModalData.imageSrc}
                        setFilePreview={(res) => setCropModalData({ ...cropModalData, imageSrc: res })}
                        cropLabel={`Crop Guardian ${(nom.guardianProofType || "PAN CARD") === "PAN CARD" ? "PAN" : "Aadhaar"}`}
                        onCropApply={(res) => handleCropComplete(res)}
                        onCancel={() => setCropModalData(null)}
                      />
                    ) : (
                      <>
                        <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", height: "48px", border: errors[`${idx}-guardianProofPath`] ? "2px dashed var(--wise-danger)" : "1.2px dashed var(--border-color)", borderRadius: "12px", background: "var(--input-bg)", cursor: "pointer", color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 700 }}>
                          <input type="file" style={{ display: "none" }} onChange={e => handleGuardianFileChange(idx, e)} accept="image/*,application/pdf" />
                          <UploadIcon /> <span>Upload Guardian {(nom.guardianProofType || "PAN CARD") === "PAN CARD" ? "PAN Card" : "Aadhaar Card"}</span>
                        </label>
                        {nom.guardianProofPath && (
                          <div style={{ marginTop: "12px", textAlign: "center", padding: "10px", borderRadius: "12px", background: "var(--wise-light-mint)", border: "1px solid var(--wise-green)", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                            {(nom.guardianProofPath.toLowerCase().endsWith(".pdf") || nom.guardianProofPath.includes("application/pdf")) ? (
                              <div style={{ width: "100%", maxWidth: "200px", height: "100px", background: "var(--bg-elevated)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-secondary)" }}>PDF Document</span>
                              </div>
                            ) : (
                              <img src={resolveAssetUrl(nom.guardianProofPath)} alt="Guardian Proof" style={{ maxWidth: "200px", maxHeight: "150px", borderRadius: "8px", objectFit: "contain", border: "1px solid var(--border-color)" }} />
                            )}
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <p style={{ fontSize: "0.7rem", color: "var(--wise-positive)", fontWeight: 800, margin: 0, whiteSpace: "nowrap" }}>✓ Guardian {(nom.guardianProofType || "PAN CARD") === "PAN CARD" ? "PAN" : "Aadhaar"} Uploaded</p>
                              <button onClick={() => setPreviewModalData({ url: resolveAssetUrl(nom.guardianProofPath) })} style={{ background: "var(--bg-secondary)", border: "none", padding: "6px", borderRadius: "8px", color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }} onMouseOver={e => e.currentTarget.style.background = "var(--border-color)"} onMouseOut={e => e.currentTarget.style.background = "var(--bg-secondary)"}>
                                <Eye size={16} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>
        ))}

        {nominees.length < 3 && (
          <div style={{ display: "flex", flexDirection: "column", maxWidth: "480px", marginLeft: "auto", marginRight: "auto", width: "100%", marginTop: "32px" }}>
            <button 
              onClick={addNominee}
              style={{ 
                height: "64px", width: "100%", borderRadius: "20px", fontSize: "1.2rem", fontWeight: 900,
                border: "1.5px solid rgba(159, 232, 112, 0.4)", background: "var(--bg-elevated)", color: "var(--text-primary)",
                boxShadow: "0 10px 30px rgba(159, 232, 112, 0.2), 0 0 20px rgba(159, 232, 112, 0.15)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", transition: "all 0.3s ease"
              }}
              onMouseOver={e => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <span style={{ fontSize: "1.6rem" }}>+</span> Add Another Nominee
            </button>
          </div>
        )}
      </div>

      {/* Action buttons at the very bottom */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 48, maxWidth: "480px", marginLeft: "auto", marginRight: "auto", width: "100%" }}>
        <button 
          onClick={handleNext} 
          className="btn btn-primary" 
          style={{ 
            background: "var(--wise-green)", color: "var(--wise-dark-green)", 
            borderRadius: "20px", height: "64px", fontSize: "1.2rem", fontWeight: 900,
            boxShadow: "0 10px 30px rgba(159, 232, 112, 0.2)"
          }}
        >
          Submit
        </button>
        <button 
          onClick={prevCorrectionStep} 
          style={{ 
            background: "transparent", color: "var(--text-primary)", 
            border: "none", fontSize: "1rem", fontWeight: 800, cursor: "pointer",
            padding: "12px", transition: "all 0.2s"
          }}
          onMouseOver={e => e.currentTarget.style.opacity = "0.7"}
          onMouseOut={e => e.currentTarget.style.opacity = "1"}
        >
          Back
        </button>
      </div>
      {/* Modal is removed since cropping is now inline */}
      
      <DocumentPreviewModal 
        isOpen={!!previewModalData} 
        onClose={() => setPreviewModalData(null)} 
        documentUrl={previewModalData?.url} 
        documentType={previewModalData?.type} 
      />
    </div>
  );
}

"use client";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useCorrection } from '@/context/CorrectionContext';
import { Upload, Check, Loader2, Eye } from "lucide-react";
import { uploadDocument, resolveAssetUrl } from "@/utils/kycApi";

import DocumentPreviewModal from "../../DocumentPreviewModal";

const CheckIcon = ({ size = 10, color = "white" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CustomSelect = ({ value, onChange, options, placeholder, error, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
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
        tabIndex={disabled ? -1 : 0}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(!isOpen);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        className="input-field"
        style={{ 
          cursor: disabled ? "not-allowed" : "pointer",
          borderColor: error ? "var(--wise-danger)" : (isOpen || isFocused) ? "var(--wise-green)" : "var(--border-color)",
          boxShadow: isFocused ? "0 0 0 3px rgba(159, 232, 112, 0.3)" : "none",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          opacity: disabled ? 0.6 : 1,
          padding: "0 16px",
          height: "46px",
          minHeight: "46px",
          background: "var(--input-bg)",
          borderRadius: "12px",
          borderWidth: "1.5px",
          borderStyle: "solid",
          outline: "none",
          transition: "all 0.2s"
        }}
      >
        <span style={{ color: value ? "var(--text-primary)" : "var(--text-muted)", fontSize: "0.95rem", fontWeight: 700 }}>
          {value || placeholder}
        </span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s", opacity: 0.5 }}>
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
      
      {isOpen && (
        <div style={{ 
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 1000, 
          background: "var(--bg-elevated)", border: "1.5px solid var(--border-color)", 
          borderRadius: "12px", marginTop: "4px", 
          boxShadow: "0 20px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)",
          maxHeight: "220px", overflowY: "auto", padding: "6px"
        }}>
          {options.map((opt) => (
            <div 
              key={opt}
              tabIndex={0}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(opt);
                  setIsOpen(false);
                  dropdownRef.current?.children[0]?.focus();
                } else if (e.key === "Escape") {
                  setIsOpen(false);
                  dropdownRef.current?.children[0]?.focus();
                }
              }}
              style={{ 
                padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 700,
                background: value === opt ? "var(--wise-green)" : "transparent",
                color: value === opt ? "var(--wise-dark-green)" : "var(--text-primary)",
                transition: "all 0.2s", marginBottom: "1px"
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

const InputGroup = ({ label, children, mandatory, style = {} }) => (
  <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", marginBottom: "14px", ...style }}>
    <div style={{ 
      flex: 1,
      fontSize: "0.85rem", 
      color: "var(--text-primary)", 
      fontWeight: 700, 
      marginBottom: "8px", 
      lineHeight: "1.2",
      minHeight: "32px",
      display: "flex",
      alignItems: "flex-end",
      paddingBottom: "2px"
    }}>
      <span style={{ display: "block", opacity: 0.85 }}>
        {label} {mandatory && <span style={{ color: "var(--wise-danger)", fontSize: "0.8rem", marginLeft: "1px" }}>*</span>}
      </span>
    </div>
    <div style={{ width: "100%" }}>
      {children}
    </div>
  </div>
);

const COMMON_INPUT_STYLE = {
  height: "46px",
  minHeight: "46px",
  borderRadius: "12px",
  fontSize: "0.95rem",
  padding: "0 16px",
  background: "var(--input-bg)",
  color: "var(--text-primary)",
  borderWidth: "1.5px",
  borderStyle: "solid",
  borderColor: "var(--border-color)",
  boxShadow: "none",
  width: "100%",
  outline: "none"
};

const CheckboxItem = ({ label, value, onChange, disabled }) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <div
      tabIndex={disabled ? -1 : 0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={{
      display: "flex",
      alignItems: "flex-start",
      width: "100%",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.8 : 1,
      marginBottom: "10px",
      gap: "8px",
      outline: "none",
      padding: "4px",
      borderRadius: "6px",
      boxShadow: isFocused ? "0 0 0 3px rgba(159, 232, 112, 0.3)" : "none",
      transition: "box-shadow 0.2s"
    }}
    onClick={() => !disabled && onChange(!value)}
    onKeyDown={(e) => {
      if (!disabled && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onChange(!value);
      }
    }}
  >
    <div style={{
      marginTop: "1px",
      minWidth: "14px", width: "14px", height: "14px", borderRadius: "3px",
      border: "1.2px solid var(--border-color)",
      background: value ? "var(--wise-green)" : "var(--input-bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      transition: "all 0.2s"
    }}>
      {value && <CheckIcon size={8} />}
    </div>
    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: "1.3", opacity: 0.85 }}>{label}</span>
  </div>
  );
};

export default function CorrectionDetailsStep({ stepId, rejectedStep }) {
  const { applicationData, drafts, saveDraft, nextCorrectionStep, prevCorrectionStep, addToast } = useCorrection();
  const personalDetails = applicationData?.personalDetails || {};
  const isPersonalDetailsRejected = rejectedStep?.type === 'module' || stepId === 'personalDetails';
  const isPepProofRejected = stepId === 'pepProof';
  const isRejection = true;
  const rejectionReasonText = rejectedStep?.reason || '';
  
  

  const initialForm = drafts[stepId] || personalDetails || {};
  const [form, setForm] = useState(initialForm);
  const clearFormDraft = () => {};

  

  const lastAutoSaveValues = useRef(form || {});
  const initializedForm = useRef(false);
  const rejectionCleared = useRef(false);

  // In rejection mode, handle blanking
  useEffect(() => {
    if (isRejection && !rejectionCleared.current) {
      if (isPersonalDetailsRejected) {
        rejectionCleared.current = true;
        // ONLY BLANK IF CORRECTION DRAFT IS EMPTY
        if (!drafts[stepId]) {
          clearFormDraft(); // Clear localStorage draft
          // Keep DigiLocker-sourced/extracted fields and revert dropdowns to default values
          setForm(prev => ({
            // Preserve read-only & extracted fields
            fullName: prev?.fullName || "",
            dob: prev?.dob || "",
            email: prev?.email || "",
            fatherName: prev?.fatherName || "",
            gender: prev?.gender || "",
            
            // Restore Default Values for Dropdowns
            citizenOfIndia: "Yes",
            politicallyExposed: "No",
            taxResidencyOutside: "No",
            taxExempt: "No",
            ddpiOptIn: "Yes",
            
            // Blank purely user-editable fields
            prefix: "",
            motherName: "",
            maritalStatus: "",
            education: "",
            occupation: "",
            annualIncome: "",
            experience: "",
            pepType: "",
          pepProof: "",
          countryOfBirth: "",
          citizenship: "",
          taxResidence1: "",
          taxId1: "",
          taxResidence2: "",
          taxId2: "",
          placeOfBirth: "",
          taxExemptReason: "",
        }));
        }
        initializedForm.current = true;
      } else if (isPepProofRejected) {
        // ONLY pepProof was rejected. Keep the rest of the form, just blank the proof.
        rejectionCleared.current = true;
        setForm(prev => ({
          ...prev,
          pepProof: "",
        }));
        // Note: we don't clear the draft here because we want to preserve the rest of the user's data
      }
    }
  }, [isRejection, isPersonalDetailsRejected, isPepProofRejected, clearFormDraft, setForm]);


  const [errors, setErrors] = useState({});
  const [showMore, setShowMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDDPIWarning, setShowDDPIWarning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await uploadDocument(file);
      if (result.success) {
        update("pepProof", result.path);
        addToast("PEP proof uploaded successfully", "success");
      }
    } catch (error) {
      addToast(error.message || "Failed to upload document", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAlphabetInput = (field) => (e) => {
    const val = e.target.value.replace(/[^a-zA-Z\s]/g, "");
    update(field, val);
  };


  useEffect(() => {
    // Don't re-initialize from backend if we already blanked due to rejection
    if (rejectionCleared.current) return;

    if (personalDetails && Object.keys(personalDetails).length > 0) {
      if (initializedForm.current) return;

      let normalizedGender = personalDetails.gender || "";
      if (normalizedGender === "M") normalizedGender = "Male";
      else if (normalizedGender === "F") normalizedGender = "Female";
      else if (normalizedGender === "T") normalizedGender = "Transgender";

      let autoPrefix = personalDetails.prefix || "";
      if (!autoPrefix && normalizedGender === "Male") autoPrefix = "Mr.";
      else if (!autoPrefix && normalizedGender === "Female") autoPrefix = "Mrs.";

      setForm(prev => ({
        ...prev,
        ...personalDetails,
        gender: normalizedGender,
        prefix: autoPrefix
      }));
      
      initializedForm.current = true;
    }
  }, [personalDetails]);


  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const errs = {};
    if (!form.fatherName?.trim()) errs.fatherName = "Req";
    if (!form.motherName?.trim()) errs.motherName = "Req";
    if (!form.gender) errs.gender = "Req";
    if (!form.maritalStatus) errs.maritalStatus = "Req";
    if (!form.education) errs.education = "Req";
    if (!form.occupation) errs.occupation = "Req";
    if (!form.annualIncome) errs.annualIncome = "Req";
    if (!form.experience) errs.experience = "Req";
    if (!form.politicallyExposed) errs.politicallyExposed = "Req";
    if (!form.taxResidencyOutside) errs.taxResidencyOutside = "Req";
    
    if (form.politicallyExposed === "Yes") {
      if (!form.pepType) errs.pepType = "Req";
      if (!form.pepProof) errs.pepProof = "Req";
    }

    if (form.taxResidencyOutside === "Yes") {
      if (!form.countryOfBirth?.trim()) errs.countryOfBirth = "Req";
      if (!form.citizenship?.trim()) errs.citizenship = "Req";
      if (!form.taxResidence1?.trim()) errs.taxResidence1 = "Req";
      if (!form.taxId1?.trim()) errs.taxId1 = "Req";
      if (!form.placeOfBirth?.trim()) errs.placeOfBirth = "Req";
      if (!form.taxExempt) errs.taxExempt = "Req";
      if (form.taxExempt === "Yes" && !form.taxExemptReason?.trim()) errs.taxExemptReason = "Req";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) {
      addToast("Please complete required fields", "error");
      return;
    }
    const success = await saveDraft(stepId, form);
    if (success) {
      nextCorrectionStep();
    }
  };

  return (
    <div className="container-lg" style={{ paddingTop: "2vh", paddingBottom: "4vh", maxWidth: "800px", margin: "0 auto", paddingLeft: "24px", paddingRight: "24px" }}>
      <div className="text-center animate-slide-up" style={{ marginBottom: 32 }}>
        <h1 className="text-section" style={{ fontSize: "1.6rem", fontWeight: 900, letterSpacing: "-0.5px" }}>Personal Details</h1>
        <p style={{ color: "var(--text-secondary)", marginTop: "4px", fontSize: "0.85rem", fontWeight: 600 }}>Please provide your background information for regulatory compliance.</p>
      </div>

      <div className="animate-slide-up">
        {isPersonalDetailsRejected && (
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
                Personal Details Rejected
              </p>
              <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.4 }}>
                {rejectionReasonText ? `Reason: ${rejectionReasonText}. ` : ""}Please fill in your correct details and proceed.
              </p>
            </div>
          </div>
        )}

        <div className="form-grid">

          <InputGroup label="Father's Name / Spouse Name" mandatory>
            <input 
              className="input-field" 
              placeholder="Full Name" 
              value={form.fatherName || ""} 
              onChange={e => update("fatherName", e.target.value)} 
              disabled={!!personalDetails.fatherName}
              style={{ 
                ...COMMON_INPUT_STYLE,
                borderColor: errors.fatherName ? "var(--wise-danger)" : "var(--border-color)",
                opacity: personalDetails.fatherName ? 0.7 : 1,
                cursor: personalDetails.fatherName ? "not-allowed" : "text"
              }} 
            />
          </InputGroup>
  
          <InputGroup label="Mother's Name" mandatory>
            <input 
              className="input-field" 
              placeholder="Full Name" 
              value={form.motherName || ""} 
              onChange={handleAlphabetInput("motherName")} 
              style={{ 
                ...COMMON_INPUT_STYLE,
                borderColor: errors.motherName ? "var(--wise-danger)" : "var(--border-color)",
              }} 
            />
          </InputGroup>
  
          <InputGroup label="Gender" mandatory>
            <CustomSelect 
              value={form.gender}
              options={["Male", "Female", "Transgender"]}
              placeholder="--Select--"
              onChange={val => update("gender", val)}
              error={errors.gender}
              disabled={!!personalDetails.gender}
            />
          </InputGroup>
  
          <InputGroup label="Marital Status" mandatory>
            <CustomSelect 
              value={form.maritalStatus}
              options={["Single", "Married"]}
              placeholder="--Select--"
              onChange={val => update("maritalStatus", val)}
              error={errors.maritalStatus}
            />
          </InputGroup>
  
          <InputGroup label="Education" mandatory>
            <CustomSelect 
              value={form.education}
              options={["Under Graduate", "Graduate", "Post Graduate", "Professional"]}
              placeholder="--Select--"
              onChange={val => update("education", val)}
              error={errors.education}
            />
          </InputGroup>
  
          <InputGroup label="Annual Income" mandatory>
            <CustomSelect 
              value={form.annualIncome}
              options={["Below 1 Lac", "1-5 Lac", "5-10 Lac", "10-25 Lac", "More Than 25 Lac"]}
              placeholder="--Select--"
              onChange={val => update("annualIncome", val)}
              error={errors.annualIncome}
            />
          </InputGroup>
  
          <InputGroup label="Trading Experience (in years)" mandatory>
            <CustomSelect 
              value={form.experience}
              options={["No Exp", "1 Year", "2 Year", "3 Year", "4 Year", "5 Year", "Above 5 Years"]}
              placeholder="--Select--"
              onChange={val => update("experience", val)}
              error={errors.experience}
            />
          </InputGroup>
  
          <InputGroup label="Occupation" mandatory>
            <CustomSelect 
              value={form.occupation}
              options={["Private Sector", "Public Sector", "Government Service", "Business", "Professional", "Retired", "Housewife", "Student", "Agriculturist"]}
              placeholder="--Select--"
              onChange={val => update("occupation", val)}
              error={errors.occupation}
            />
          </InputGroup>

          <InputGroup label="Politically Exposed" mandatory>
            <CustomSelect 
              value={form.politicallyExposed}
              options={["No", "Yes"]}
              placeholder="--Select--"
              onChange={val => {
                update("politicallyExposed", val);
                if (val === "No") {
                  setForm(prev => ({ ...prev, pepType: "", pepProof: null, pepComment: "" }));
                }
              }}
              error={errors.politicallyExposed}
            />
          </InputGroup>

          {form.politicallyExposed === "Yes" && (
            <>
              <InputGroup label="PEP Status" mandatory>
                <CustomSelect 
                  value={form.pepType}
                  options={["PEP", "RPEP"]}
                  placeholder="--Select--"
                  onChange={val => update("pepType", val)}
                  error={errors.pepType}
                />
              </InputGroup>

              <InputGroup label="Proof of PEP Status" mandatory>
                <div style={{ position: "relative", width: "100%" }}>
                      <label 
                        tabIndex={isUploading ? -1 : 0}
                        onFocus={(e) => e.currentTarget.style.boxShadow = "0 0 0 3px rgba(159, 232, 112, 0.3)"}
                        onBlur={(e) => e.currentTarget.style.boxShadow = "none"}
                        onKeyDown={(e) => {
                          if (!isUploading && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            e.currentTarget.querySelector('input[type="file"]').click();
                          }
                        }}
                        className="input-field"
                        style={{ 
                          height: "42px", 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between",
                          cursor: "pointer",
                          padding: "0 12px",
                          borderRadius: "10px",
                      border: form.pepProof ? "1.2px solid var(--border-color)" : "1.2px dashed var(--border-color)",
                      background: "var(--input-bg)",
                      outline: "none"
                    }}
                  >
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: form.pepProof ? "var(--wise-green)" : "var(--text-muted)" }}>
                      {isUploading ? "Uploading..." : form.pepProof ? "Document uploaded" : "Upload Document"}
                    </span>
                    {isUploading ? (
                      <Loader2 size={16} className="animate-spin" style={{ color: "var(--wise-green)" }} />
                    ) : form.pepProof ? (
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <Check size={16} style={{ color: "var(--wise-green)" }} />
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewUrl(resolveAssetUrl(form.pepProof)); }} style={{ color: "var(--text-primary)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <Eye size={16} />
                        </div>
                        <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); update("pepProof", null); }} style={{ color: "var(--wise-danger)", cursor: "pointer", display: "flex", alignItems: "center" }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <Upload size={16} style={{ color: "var(--text-muted)" }} />
                    )}
                    <input type="file" style={{ display: "none" }} onChange={handleFileChange} disabled={isUploading} />
                  </label>
                </div>
              </InputGroup>

              <InputGroup label="Comments (Optional)">
                <input 
                  className="input-field" 
                  placeholder="Additional details..." 
                  value={form.pepComment || ""} 
                  onChange={e => update("pepComment", e.target.value)} 
                  style={{ 
                    ...COMMON_INPUT_STYLE,
                    borderColor: "var(--border-color)",
                  }} 
                />
              </InputGroup>
            </>
          )}

          <InputGroup label="Citizen of India?" mandatory>
            <CustomSelect value={form.isIndianCitizen || "Yes"} options={["Yes", "No"]} disabled onChange={() => {}} />
          </InputGroup>

          <InputGroup label="Tax Residency outside India" mandatory>
            <CustomSelect 
              value={form.taxResidencyOutside} 
              options={["No", "Yes"]} 
              onChange={val => {
                update("taxResidencyOutside", val);
                if (val === "No") {
                  setForm(prev => ({
                    ...prev,
                    countryOfBirth: "",
                    citizenship: "",
                    taxResidence1: "",
                    taxId1: "",
                    taxResidence2: "",
                    taxId2: "",
                    taxResidence3: "",
                    taxId3: "",
                    placeOfBirth: "",
                    taxExempt: "",
                    taxExemptReason: ""
                  }));
                }
              }} 
            />
          </InputGroup>
          
          {form.taxResidencyOutside === "Yes" && (
            <>
              <InputGroup label="Country of birth" mandatory>
                <input 
                  className="input-field" placeholder="Country of birth" 
                  value={form.countryOfBirth || ""} 
                  onChange={handleAlphabetInput("countryOfBirth")} 
                  style={{ ...COMMON_INPUT_STYLE, borderColor: errors.countryOfBirth ? "var(--wise-danger)" : "var(--border-color)" }} 
                />
              </InputGroup>
              <InputGroup label="Citizenship" mandatory>
                <input 
                  className="input-field" placeholder="Citizenship" 
                  value={form.citizenship || ""} 
                  onChange={handleAlphabetInput("citizenship")} 
                  style={{ ...COMMON_INPUT_STYLE, borderColor: errors.citizenship ? "var(--wise-danger)" : "var(--border-color)" }} 
                />
              </InputGroup>
              <InputGroup label="Country of Tax Residence1" mandatory>
                <input 
                  className="input-field" placeholder="Country of Tax Residence 1" 
                  value={form.taxResidence1 || ""} 
                  onChange={handleAlphabetInput("taxResidence1")} 
                  style={{ ...COMMON_INPUT_STYLE, borderColor: errors.taxResidence1 ? "var(--wise-danger)" : "var(--border-color)" }} 
                />
              </InputGroup>
              <InputGroup label="Tax Payer Identification Number1" mandatory>
                <input 
                  className="input-field" placeholder="Tax ID 1" 
                  value={form.taxId1 || ""} 
                  onChange={e => update("taxId1", e.target.value)} 
                  style={{ ...COMMON_INPUT_STYLE, borderColor: errors.taxId1 ? "var(--wise-danger)" : "var(--border-color)" }} 
                />
              </InputGroup>
              <InputGroup label="Country of Tax Residence2">
                <input 
                  className="input-field" placeholder="Country of Tax Residence 2" 
                  value={form.taxResidence2 || ""} 
                  onChange={handleAlphabetInput("taxResidence2")} 
                  style={COMMON_INPUT_STYLE}
                />
              </InputGroup>
              <InputGroup label="Tax Payer Identification Number2">
                <input 
                  className="input-field" placeholder="Tax ID 2" 
                  value={form.taxId2 || ""} 
                  onChange={e => update("taxId2", e.target.value)} 
                  style={COMMON_INPUT_STYLE}
                />
              </InputGroup>
              <InputGroup label="Country Tax Residence3">
                <input 
                  className="input-field" placeholder="Country Tax Residence 3" 
                  value={form.taxResidence3 || ""} 
                  onChange={handleAlphabetInput("taxResidence3")} 
                  style={COMMON_INPUT_STYLE}
                />
              </InputGroup>
              <InputGroup label="Tax Identification Number 3">
                <input 
                  className="input-field" placeholder="Tax ID 3" 
                  value={form.taxId3 || ""} 
                  onChange={e => update("taxId3", e.target.value)} 
                  style={COMMON_INPUT_STYLE}
                />
              </InputGroup>
              <InputGroup label="Place of Birth" mandatory>
                <input 
                  className="input-field" placeholder="Place of Birth" 
                  value={form.placeOfBirth || ""} 
                  onChange={handleAlphabetInput("placeOfBirth")} 
                  style={{ ...COMMON_INPUT_STYLE, borderColor: errors.placeOfBirth ? "var(--wise-danger)" : "var(--border-color)" }} 
                />
              </InputGroup>
              <InputGroup label="TAX Exempt" mandatory>
                <CustomSelect 
                  value={form.taxExempt} 
                  options={["No", "Yes"]} 
                  placeholder="--Select--"
                  onChange={val => update("taxExempt", val)} 
                  error={errors.taxExempt} 
                />
              </InputGroup>
              {form.taxExempt === "Yes" && (
                <InputGroup label="Tax Exempt Reason" mandatory style={{ gridColumn: "1 / -1" }}>
                  <input 
                    className="input-field" placeholder="Tax Exempt Reason" 
                    value={form.taxExemptReason || ""} 
                    onChange={e => update("taxExemptReason", e.target.value)} 
                  style={{ ...COMMON_INPUT_STYLE, borderColor: errors.taxExemptReason ? "var(--wise-danger)" : "var(--border-color)" }} 
                  />
                </InputGroup>
              )}
            </>
          )}

          {!showMore && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", margin: "32px auto 16px auto", maxWidth: "400px", width: "100%" }}>
              <button type="button" className="btn btn-sm" onClick={() => setShowMore(true)} style={{ 
                background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 800, 
                padding: "14px 36px", border: "1.5px solid rgba(159, 232, 112, 0.4)", borderRadius: "100px", 
                boxShadow: "0 10px 30px rgba(159, 232, 112, 0.2), 0 0 20px rgba(159, 232, 112, 0.15)", 
                cursor: "pointer", transition: "all 0.3s ease", width: "100%"
              }}>
                Show additional options ▼
              </button>
            </div>
          )}

          {showMore && (
            <>
              <InputGroup label="Execute DDPI?" mandatory>
                <CustomSelect 
                  value={form.ddpi}
                  options={["Yes", "No"]}
                  onChange={val => {
                    const isYes = val === "Yes";
                    if (!isYes) {
                      setShowDDPIWarning(true);
                      // Auto-uncheck derivatives in Pricing/Segment step
                      // updateNested("segments", { derivatives: false });
                    } else {
                      // Restore derivatives when switching back to Yes
                      // updateNested("segments", { derivatives: true });
                    }
                    setForm(prev => ({ 
                      ...prev, 
                      ddpi: val, 
                      operatedThroughDDPI: val, 
                      transferSecurities: isYes, 
                      pledgeSecurities: isYes, 
                      mfTransactions: isYes, 
                      tenderingShares: isYes 
                    }));
                  }}
                />
              </InputGroup>

              {form.ddpi === "Yes" && (
                <div style={{ gridColumn: "1 / -1", marginBottom: "16px" }}>
                  <CheckboxItem 
                    label="Transfer of securities held in the beneficial owner accounts of the client towards Stock Exchange related deliveries / settlement obligations arising out of trades executed by clients on the Stock Exchange through the same stock broker" 
                    value={form.transferSecurities} 
                    onChange={val => update("transferSecurities", val)} 
                    disabled={form.ddpi === "Yes"} 
                  />
                  <CheckboxItem 
                    label="Pledging / re-pledging of securities in favour of trading member (TM) / clearing member (CM) for the purpose of meeting margin requirements of the clients in connection with the trades executed by the clients on the Stock Exchange." 
                    value={form.pledgeSecurities} 
                    onChange={val => update("pledgeSecurities", val)} 
                    disabled={form.ddpi === "Yes"} 
                  />
                  <CheckboxItem 
                    label="Mutual Fund transactions being executed on Stock Exchange order entry platforms" 
                    value={form.mfTransactions} 
                    onChange={val => update("mfTransactions", val)} 
                    disabled={form.ddpi === "Yes"} 
                  />
                  <CheckboxItem 
                    label="Tendering shares in open offers through Stock Exchange platforms" 
                    value={form.tenderingShares} 
                    onChange={val => update("tenderingShares", val)} 
                    disabled={form.ddpi === "Yes"} 
                  />
                </div>
              )}

              <InputGroup label="Do you wish to apply for DIS (Delivery Instruction Slip) Booklet" mandatory>
                <CustomSelect value={form.dis} options={["No", "Yes"]} onChange={val => update("dis", val)} />
              </InputGroup>

              <InputGroup label="I/We authorise you to receive credits automatically into my/our account" mandatory>
                <CustomSelect value={form.receiveCredits} options={["Yes", "No"]} onChange={val => update("receiveCredits", val)} />
              </InputGroup>

              <InputGroup label="Client option to receive e-statement" mandatory>
                <CustomSelect value={form.eStatement} options={["Yes", "No"]} onChange={val => update("eStatement", val)} />
              </InputGroup>

              <InputGroup label="I/We would like to instruct the DP to accept all the pledge instructions in my/our account without any other further instruction from my/our end." mandatory>
                <CustomSelect value={form.acceptPledgeInstructions} options={["No", "Yes"]} onChange={val => update("acceptPledgeInstructions", val)} />
              </InputGroup>

              <InputGroup label="Receive Annual Reports, AGM notices and other communication from Issuer & RTA in Electronic form Account to be opened through DDPI" mandatory>
                <CustomSelect value={form.receiveAnnualReports} options={["Yes", "No"]} onChange={val => update("receiveAnnualReports", val)} />
              </InputGroup>

              <InputGroup label="Account Settlement" mandatory>
                <CustomSelect value={form.settlement} options={["Quarterly", "Monthly"]} onChange={val => update("settlement", val)} />
              </InputGroup>

              <InputGroup label="SMS Alert Facility (Mandatory if given DDPI)" mandatory>
                <CustomSelect value={form.smsAlert} options={["Yes", "No"]} disabled onChange={() => {}} />
              </InputGroup>

              <InputGroup label="Account to be Operated through DDPI" mandatory>
                <CustomSelect value={form.operatedThroughDDPI} options={["Yes", "No"]} disabled onChange={() => {}} />
              </InputGroup>

              <div style={{ gridColumn: "1 / -1", textAlign: "center", margin: "32px auto 16px auto", maxWidth: "400px", width: "100%" }}>
                <button type="button" className="btn btn-sm" onClick={() => setShowMore(false)} style={{ 
                  background: "var(--bg-elevated)", color: "var(--text-primary)", fontSize: "0.95rem", fontWeight: 800, 
                  padding: "14px 36px", border: "1.5px solid rgba(159, 232, 112, 0.4)", borderRadius: "100px", 
                  boxShadow: "0 10px 30px rgba(159, 232, 112, 0.2), 0 0 20px rgba(159, 232, 112, 0.15)", 
                  cursor: "pointer", transition: "all 0.3s ease", width: "100%"
                }}>
                  Hide additional options ▲
                </button>
              </div>
            </>
          )}

          <div style={{ gridColumn: "1 / -1", marginTop: 32, display: "flex", flexDirection: "column", gap: 12, maxWidth: "400px", marginLeft: "auto", marginRight: "auto", width: "100%" }}>
            <button className="btn btn-primary" onClick={handleNext}>
              Continue
            </button>
            <button className="btn btn-secondary" onClick={prevCorrectionStep}>
              Back
            </button>
          </div>

        </div>
      </div>
      
      <DocumentPreviewModal 
        isOpen={!!previewUrl} 
        onClose={() => setPreviewUrl(null)} 
        documentUrl={previewUrl} 
      />

      {showDDPIWarning && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(14, 15, 12, 0.4)",
          backdropFilter: "blur(24px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 100000, padding: "20px"
        }}>
          <div className="animate-slide-up" style={{
            maxWidth: "500px", width: "100%", padding: "40px",
            background: "#ffffff", borderRadius: "32px",
            textAlign: "center", border: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.15)"
          }}>
            <p style={{
              fontSize: "1.05rem", lineHeight: "1.6", color: "#0e0f0c",
              fontWeight: 700, marginBottom: "32px", textAlign: "center"
            }}>
              If DDPI is selected as "No", the client is required to submit a duly signed physical Delivery Instruction Slip (DIS) to the DP for securities pay-in, buyback, tender offer, and mutual fund redemption transactions, and in case of pledge, a duly signed Pledge Creation Form must also be submitted to the DP for processing.
            </p>
            <button
              onClick={() => setShowDDPIWarning(false)}
              className="btn btn-primary"
              style={{
                width: "120px", height: "48px", minHeight: "48px",
                borderRadius: "12px", fontSize: "1rem", fontWeight: 900,
                margin: "0 auto"
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

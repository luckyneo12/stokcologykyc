"use client";
import { useState } from "react";
import { useKYC } from "@/context/KYCContext";
import { getPincodeData } from "@/utils/kycApi";
import { MapPinIcon, ArrowLeftIcon, ArrowRightIcon } from "../Icons";
import Logo from "../Logo";

export default function AddressStep() {
  const { address, updateNested, nextStep, prevStep, addToast } = useKYC();
  const [form, setForm] = useState(address);

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handlePincodeChange = async (e) => {
    const val = e.target.value.replace(/\D/g, "");
    update("pincode", val);
    if (val.length === 6) {
      try {
        const data = await getPincodeData(val);
        if (data && data.success) {
          setForm(prev => ({
            ...prev,
            city: data.city !== "Unknown" ? data.city : prev.city,
            state: data.state !== "Unknown" ? data.state : prev.state
          }));
        }
      } catch (error) {
        console.error("Failed to fetch pincode data:", error);
      }
    }
  };

  const handleNext = () => {
    if (!form.line1 || !form.city || !form.pincode) { addToast("Please fill in required address fields", "error"); return; }
    nextStep({ address: form });
  };

  return (
    <div className="container-sm">
      <div className="text-center animate-slide-up" style={{ marginBottom: 40 }}>
        <h2 className="text-section" style={{ marginBottom: 16 }}>Current Address</h2>
        <p className="text-body">Provide your primary correspondence address.</p>
      </div>

      <div className="card animate-slide-up" style={{ marginBottom: 32 }}>
        <div className="input-group" style={{ marginBottom: 24 }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>Address Line 1</label>
          <input className="input-field" placeholder="Building, Street, Landmark" value={form.line1 || ""} onChange={e => update("line1", e.target.value)} />
        </div>
        
        <div className="form-grid-2" style={{ marginBottom: 24 }}>
          <div className="input-group">
            <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>PIN Code</label>
            <input className="input-field" placeholder="000000" value={form.pincode || ""} onChange={handlePincodeChange} maxLength={6} />
          </div>
          <div className="input-group">
            <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>City</label>
            <input className="input-field" placeholder="e.g. Mumbai" value={form.city || ""} onChange={e => update("city", e.target.value)} />
          </div>
        </div>

        <div className="input-group" style={{ marginBottom: 32 }}>
          <label className="text-body-bold" style={{ display: "block", marginBottom: 8, fontSize: "0.85rem" }}>State</label>
          <input className="input-field" placeholder="e.g. Maharashtra" value={form.state || ""} onChange={e => update("state", e.target.value)} />
        </div>

        <div className="flex gap-md">
          <button className="btn btn-secondary" onClick={prevStep} style={{ flex: 1 }}>
            <ArrowLeftIcon size={20} /> Back
          </button>
          <button className="btn btn-primary" onClick={handleNext} style={{ flex: 1.5 }}>
            Continue <ArrowRightIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

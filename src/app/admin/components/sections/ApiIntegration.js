"use client";
import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "@/utils/apiConfig";
import { KeyRound, Settings, Eye, EyeOff, Trash2, Plug, X } from "lucide-react";

export default function ApiIntegration() {
  const [activeTab, setActiveTab] = useState("credentials");
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    baseUrl: "http://192.168.0.22:15000/api",
    username: "INHOUSE",
    password: "Orion@1234",
    firmId: "1001",
    financialYear: "2022-2023"
  });

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const token = localStorage.getItem("adminToken");
      const response = await fetch(`${API_BASE_URL}/api/admin/backoffice/test-connection`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      if (data.success) {
        setTestResult({ success: true, message: data.message || "Connection successful! Backoffice API is reachable." });
      } else {
        setTestResult({ success: false, message: data.error || "Connection failed. Please check your credentials." });
      }
    } catch (err) {
      setTestResult({ success: false, message: "Connection failed. Cannot reach server." });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    // Simulate save
    alert("Configuration saved successfully!");
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", animation: "fadeIn 0.4s ease-out" }}>
      <style dangerouslySetInnerHTML={{__html: `
        .api-input {
          width: 100%;
          padding: 12px 16px;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          background: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.95rem;
          transition: all 0.2s ease;
          outline: none;
        }
        .api-input:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
        }
        .api-label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .required-star {
          color: #ef4444;
          margin-left: 4px;
        }
        .api-btn {
          padding: 10px 24px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s ease;
          border: none;
        }
        .btn-delete {
          background: transparent;
          border: 1px solid #ef4444;
          color: #ef4444;
        }
        .btn-delete:hover {
          background: #ef444410;
        }
        .btn-test {
          background: #0ea5e9;
          color: white;
        }
        .btn-test:hover {
          background: #0284c7;
        }
        .btn-test:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .btn-close {
          background: #64748b;
          color: white;
        }
        .btn-close:hover {
          background: #475569;
        }
        .btn-save {
          background: #8b5cf6;
          color: white;
        }
        .btn-save:hover {
          background: #7c3aed;
        }
      `}} />

      <div style={{
        background: "var(--bg-card)",
        borderRadius: 24,
        border: "1px solid var(--border-color)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.04)",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{ 
          padding: "24px 32px", 
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-elevated)"
        }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary)" }}>
            Orion / FinKORP API Integration
          </h2>
          <button style={{ 
            background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer",
            padding: 8, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center"
          }} className="hover-bg">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ padding: "32px 32px 0" }}>
          <div style={{ 
            display: "flex", 
            background: "var(--bg-secondary)", 
            borderRadius: 12, 
            padding: 6,
            gap: 4
          }}>
            <button 
              onClick={() => setActiveTab("credentials")}
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                background: activeTab === "credentials" ? "var(--bg-card)" : "transparent",
                color: activeTab === "credentials" ? "#8b5cf6" : "var(--text-secondary)",
                fontWeight: 600,
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: activeTab === "credentials" ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s"
              }}
            >
              <KeyRound size={18} /> Credentials
            </button>
            <button 
              onClick={() => setActiveTab("workflow")}
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                background: activeTab === "workflow" ? "var(--bg-card)" : "transparent",
                color: activeTab === "workflow" ? "#8b5cf6" : "var(--text-secondary)",
                fontWeight: 600,
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                boxShadow: activeTab === "workflow" ? "0 2px 8px rgba(0,0,0,0.05)" : "none",
                transition: "all 0.2s"
              }}
            >
              <Settings size={18} /> Workflow & Mappings
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div style={{ padding: "32px" }}>
          {activeTab === "credentials" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              
              <div>
                <label className="api-label">Orion API Base URL <span className="required-star">*</span></label>
                <input 
                  type="text" 
                  className="api-input" 
                  name="baseUrl"
                  value={formData.baseUrl}
                  onChange={handleChange}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <label className="api-label">API Username <span className="required-star">*</span></label>
                  <input 
                    type="text" 
                    className="api-input" 
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="api-label">API Password <span className="required-star">*</span></label>
                  <div style={{ position: "relative" }}>
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="api-input" 
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      style={{ paddingRight: 48 }}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                        background: "transparent", border: "none", color: "var(--text-muted)",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div>
                  <label className="api-label">Firm ID <span className="required-star">*</span></label>
                  <input 
                    type="text" 
                    className="api-input" 
                    name="firmId"
                    value={formData.firmId}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="api-label">Financial Year</label>
                  <input 
                    type="text" 
                    className="api-input" 
                    name="financialYear"
                    value={formData.financialYear}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {testResult && (
                <div style={{ 
                  padding: "16px", 
                  borderRadius: 12, 
                  background: testResult.success ? "#10b98115" : "#ef444415",
                  border: `1px solid ${testResult.success ? '#10b98140' : '#ef444440'}`,
                  color: testResult.success ? "#10b981" : "#ef4444",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: testResult.success ? "#10b981" : "#ef4444" }} />
                  {testResult.message}
                </div>
              )}

            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              <Settings size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <p>Workflow & Mappings settings will be displayed here.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ 
          padding: "24px 32px", 
          borderTop: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--bg-elevated)"
        }}>
          <button className="api-btn btn-delete">
            <Trash2 size={18} /> Delete Rule
          </button>
          
          <div style={{ display: "flex", gap: 16 }}>
            <button className="api-btn btn-test" onClick={handleTestConnection} disabled={testing}>
              <Plug size={18} /> {testing ? "Testing..." : "Test Connection"}
            </button>
            <button className="api-btn btn-close">
              Close
            </button>
            <button className="api-btn btn-save" onClick={handleSave}>
              Save Configuration
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

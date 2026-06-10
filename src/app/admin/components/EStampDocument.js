import React from 'react';

const EStampDocument = ({ eStamp, approvedDate, fullName }) => {
  // Format dates
  const formatStampDate = (dateString) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    return d.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).replace(/,/g, '');
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    return d.toLocaleDateString('en-GB'); // DD/MM/YYYY
  };

  const generateRandomDocRef = () => {
    // Generates a mock SUBIN reference like SUBIN-DLDL82800394538413296571Y
    return `SUBIN-DLDL${Math.floor(100000000000000 + Math.random() * 900000000000000)}Y`;
  };

  const certificateNo = eStamp ? `IN-DLB90038689${eStamp}Y` : "Not Assigned";
  const issueDate = formatStampDate(approvedDate || new Date());
  const shortDate = formatShortDate(approvedDate || new Date());
  const docRef = React.useMemo(() => generateRandomDocRef(), []);

  return (
    <div style={{
      fontFamily: "'Times New Roman', Times, serif",
      background: "#ffffff",
      color: "#000000",
      width: "100%",
      maxWidth: "800px",
      margin: "0 auto",
      padding: "40px",
      border: "1px solid #ccc",
      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
      position: "relative"
    }}>
      {/* Top Red Numbers Placeholder (Rotated) */}
      <div style={{
        position: "absolute",
        right: "20px",
        top: "60px",
        transform: "rotate(-90deg)",
        transformOrigin: "right top",
        color: "#d93025",
        fontWeight: "bold",
        letterSpacing: "2px",
        fontSize: "1.2rem",
        opacity: 0.8
      }}>
        {eStamp ? eStamp : "000000"}
      </div>

      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Emblem_of_India.svg/300px-Emblem_of_India.svg.png" 
          alt="Satyameva Jayate" 
          style={{ height: "80px", marginBottom: "10px", opacity: 0.85 }} 
        />
        <div style={{ fontSize: "1.1rem", fontWeight: "bold", letterSpacing: "1px", marginBottom: "5px" }}>
          INDIA NON JUDICIAL
        </div>
        <div style={{ fontSize: "1.3rem", fontWeight: "bold" }}>
          Government of National Capital Territory of Delhi
        </div>
        <div style={{ fontSize: "1.1rem", fontWeight: "bold", marginTop: "15px" }}>
          e-Stamp
        </div>
      </div>

      {/* Details Table */}
      <div style={{ display: "grid", gridTemplateColumns: "250px 10px 1fr", rowGap: "8px", fontSize: "0.85rem", lineHeight: "1.4" }}>
        
        <div style={{ fontWeight: "600" }}>Certificate No.</div>
        <div>:</div>
        <div>{certificateNo}</div>

        <div style={{ fontWeight: "600" }}>Certificate Issued Date</div>
        <div>:</div>
        <div>{issueDate}</div>

        <div style={{ fontWeight: "600" }}>Account Reference</div>
        <div>:</div>
        <div>IMPACC (IV)/ dl828003/ DELHI/ DL-CTD</div>

        <div style={{ fontWeight: "600" }}>Unique Doc. Reference</div>
        <div>:</div>
        <div>{docRef}</div>

        <div style={{ fontWeight: "600" }}>Purchased by</div>
        <div>:</div>
        <div>STOCKOLOGY SECURITIES PRIVATE LIMITED</div>

        <div style={{ fontWeight: "600" }}>Description of Document</div>
        <div>:</div>
        <div>Article 48(c) Power of attorney - GPA</div>

        <div style={{ fontWeight: "600" }}>Property Description</div>
        <div>:</div>
        <div>This non- judicial stamp paper of Rs. 100 forms a part and parcel of DDPI<br/>(Demat Debit and Pledge Instruction) Agreement executed in favor of<br/>STOCKOLOGY SECURITIES PRIVATE LIMITED</div>

        <div style={{ fontWeight: "600" }}>Consideration Price (Rs.)</div>
        <div>:</div>
        <div>0<br/>(Zero)</div>

        <div style={{ fontWeight: "600" }}>First Party</div>
        <div>:</div>
        <div>STOCKOLOGY SECURITIES PRIVATE LIMITED</div>

        <div style={{ fontWeight: "600" }}>Second Party</div>
        <div>:</div>
        <div>Not Applicable</div>

        <div style={{ fontWeight: "600" }}>Stamp Duty Paid By</div>
        <div>:</div>
        <div>STOCKOLOGY SECURITIES PRIVATE LIMITED</div>

        <div style={{ fontWeight: "600" }}>Stamp Duty Amount(Rs.)</div>
        <div>:</div>
        <div>100<br/>(One Hundred only)</div>

      </div>

      {/* QR/Barcode Placeholder */}
      <div style={{ marginTop: "20px", marginBottom: "30px", paddingLeft: "10px" }}>
        <img 
          src="https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/QR_code_for_mobile_English_Wikipedia.svg/200px-QR_code_for_mobile_English_Wikipedia.svg.png" 
          alt="QR Code" 
          style={{ width: "80px", height: "80px", opacity: 0.6 }} 
        />
      </div>

      {/* Divider */}
      <div style={{ position: "relative", textAlign: "center", marginBottom: "30px" }}>
        <div style={{ borderTop: "1px dashed #666", width: "100%", position: "absolute", top: "50%", zIndex: 1 }}></div>
        <span style={{ background: "#fff", padding: "0 10px", fontSize: "0.75rem", fontStyle: "italic", color: "#666", position: "relative", zIndex: 2 }}>
          Please write or type below this line
        </span>
      </div>

      {/* Below Line Content */}
      <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "1.1rem", marginBottom: "20px" }}>
        Demat Debit and Pledge Instruction (DDPI)
      </div>

      <div style={{ fontSize: "0.95rem", lineHeight: "1.8", marginBottom: "40px" }}>
        This non Judicial Stamp Paper of Rs. 100/- form part and parcel of the "Demat Debit
        and Pledge Instructions(DDPI)" executed by<br/>
        Mr./Mrs./Ms./M/s. <span style={{ textDecoration: "underline", color: "blue", fontFamily: "'Caveat', cursive", fontSize: "1.4rem", padding: "0 10px" }}>{fullName || "___________________________"}</span> on <span style={{ textDecoration: "underline", color: "blue", fontFamily: "'Caveat', cursive", fontSize: "1.2rem", padding: "0 10px" }}>{shortDate}</span>
      </div>

      {/* Signatures */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "20px", marginTop: "40px", fontSize: "0.75rem", color: "#555" }}>
        <div style={{ borderTop: "1px dotted #999", paddingTop: "5px", textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: "-30px", left: "0", right: "0", textAlign: "center", color: "blue", fontFamily: "'Caveat', cursive", fontSize: "1.3rem" }}>E-signed</div>
          Signature of 1st Holder
        </div>
        <div style={{ borderTop: "1px dotted #999", paddingTop: "5px", textAlign: "center" }}>
          Signature of 2nd Holder
        </div>
        <div style={{ borderTop: "1px dotted #999", paddingTop: "5px", textAlign: "center" }}>
          Signature of 3rd Holder
        </div>
      </div>

      {/* Statutory Alert */}
      <div style={{ marginTop: "50px", fontSize: "0.6rem", color: "#666", borderTop: "1px solid #ddd", paddingTop: "10px" }}>
        <strong>Statutory Alert:</strong><br/>
        1. The authenticity of this Stamp certificate should be verified at 'www.shcilestamp.com' or using e-Stamp Mobile App of Stock Holding.<br/>
        Any discrepancy in the details on this Certificate and as available on the website / Mobile App renders it invalid.<br/>
        2. The onus of checking the legitimacy is on the users of the certificate.<br/>
        3. In case of any discrepancy please inform the Competent Authority.
      </div>
    </div>
  );
};

export default EStampDocument;

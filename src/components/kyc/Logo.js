export default function Logo({ width = 120, height = 40, className = "", variant = "standard" }) {
  const logoSrc = variant === "bull" ? "/bull-logo.png" : "/stklogo.png";
  
  return (
    <div className={`flex items-center ${className}`}>
      <img 
        src={logoSrc} 
        alt="Stockology" 
        style={{ 
          width: width, 
          height: height, 
          objectFit: 'contain' 
        }} 
        onError={(e) => {
          // Fallback if bull-logo doesn't exist yet
          if (variant === "bull") e.target.src = "/stklogo.png";
        }}
      />
    </div>
  );
}

import "../globals.css";
import "./globe-table.css";

export const metadata = {
  title: "Globe UAT - Dashboard",
  description: "Globe portal for reviewing and approving KYC applications.",
};

export default function GlobeLayout({ children }) {
  return (
    <div className="globe-portal-theme" style={{ minHeight: "100vh", width: "100%" }}>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                document.documentElement.setAttribute('data-theme', 'light');
              } catch (e) {}
            })();
          `,
        }}
      />
      {children}
    </div>
  );
}

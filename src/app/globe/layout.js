import "../globals.css";
import "./globe-table.css";
import "../admin/admin-neu.css";
import "./globe-neu.css";
import GlobeThemeShell from "./components/GlobeThemeShell";

export const metadata = {
  title: "Globe UAT - Dashboard",
  description: "Globe portal for reviewing and approving KYC applications.",
};

export default function GlobeLayout({ children }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                // Globe keeps its own light / dark choice (theme button in the header)
                var theme = localStorage.getItem('globeTheme');
                // The sign-in pages are always light
                if (/^\\/globe\\/(login|forgot-password|reset-password)/.test(location.pathname)) theme = 'light';
                document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
              } catch (e) {}
            })();
          `,
        }}
      />
      {/* Same soft-UI look as the admin portal, in Globe green (sign-in pages keep their own design) */}
      <GlobeThemeShell>{children}</GlobeThemeShell>
    </>
  );
}

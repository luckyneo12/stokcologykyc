import "../globals.css";

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
                document.documentElement.setAttribute('data-theme', 'light');
              } catch (e) {}
            })();
          `,
        }}
      />
      {children}
    </>
  );
}

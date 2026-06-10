import "../globals.css";

export const metadata = {
  title: "SecureKYC Admin - Dashboard",
  description: "Admin dashboard for managing KYC applications, approvals, and compliance.",
};

export default function AdminLayout({ children }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var theme = localStorage.getItem('adminTheme');
                if (theme === 'dark') {
                  document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch (e) {}
            })();
          `,
        }}
      />
      {children}
    </>
  );
}

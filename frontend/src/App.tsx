import { useState } from "react";
import { Outlet, type RouteObject, RouterProvider, createBrowserRouter } from "react-router";
import { Toaster } from "sonner";

import { NotFound } from "./components/layout/NotFound";
import { ServerBanner } from "./components/layout/ServerBanner";
import { SkipLink } from "./components/layout/SkipLink";
import { type NavSection, TopBar } from "./components/layout/TopBar";
import { crmRoutes, crmSections } from "./crm/routes";

// The only file that puts the areas together. A later area adds its sections
// and routes here, beside the CRM's.
export const sections: NavSection[] = [...crmSections];

function Shell() {
  return (
    <>
      <SkipLink />
      <TopBar sections={sections} />
      <ServerBanner />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Toaster position="bottom-center" toastOptions={{ className: "font-sans" }} />
    </>
  );
}

export const routes: RouteObject[] = [
  {
    element: <Shell />,
    children: [...crmRoutes, { path: "*", element: <NotFound /> }],
  },
];

export default function App() {
  const [router] = useState(() => createBrowserRouter(routes));
  return <RouterProvider router={router} />;
}

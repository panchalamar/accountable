import { Building2, CircleDollarSign, LayoutDashboard, SquareKanban, Users } from "lucide-react";
import type { RouteObject } from "react-router";

import type { NavSection } from "../components/layout/TopBar";
import { ContactPage } from "./pages/ContactPage";
import { ContactsPage } from "./pages/ContactsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DealPage } from "./pages/DealPage";
import { DealsPage } from "./pages/DealsPage";
import { OrganizationPage } from "./pages/OrganizationPage";
import { OrganizationsPage } from "./pages/OrganizationsPage";
import { PipelinePage } from "./pages/PipelinePage";

/** The CRM's sections in the top bar, in order. */
export const crmSections: NavSection[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/organizations", label: "Organizations", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/deals", label: "Deals", icon: CircleDollarSign },
  { to: "/pipeline", label: "Pipeline", icon: SquareKanban },
];

/** The CRM's pages, for App.tsx to add under the shell. */
export const crmRoutes: RouteObject[] = [
  { index: true, element: <DashboardPage /> },
  { path: "organizations", element: <OrganizationsPage /> },
  { path: "organizations/:id", element: <OrganizationPage /> },
  { path: "contacts", element: <ContactsPage /> },
  { path: "contacts/:id", element: <ContactPage /> },
  { path: "deals", element: <DealsPage /> },
  { path: "deals/:id", element: <DealPage /> },
  { path: "pipeline", element: <PipelinePage /> },
];

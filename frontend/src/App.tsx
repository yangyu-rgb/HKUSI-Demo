import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layout/AppLayout";
import { AlertsPage } from "./pages/AlertsPage";
import { BusinessPage } from "./pages/BusinessPage";
import { CrowdsourcePage } from "./pages/CrowdsourcePage";
import { HomePage } from "./pages/HomePage";
import { PlannerPage } from "./pages/PlannerPage";


export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="planner" element={<PlannerPage />} />
        <Route path="crowdsource" element={<CrowdsourcePage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="business" element={<BusinessPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}


function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>;
}

export default App;

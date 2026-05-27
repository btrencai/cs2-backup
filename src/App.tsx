import { HashRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "@heroui/react";
import FirstRunSetup from "./components/FirstRunSetup";
import UpdateChecker from "./components/UpdateChecker";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import BackupList from "./pages/BackupList";
import AutoCfgEditor from "./pages/AutoCfgEditor";
import Settings from "./pages/Settings";

function App() {
  return (
    <>
      <ToastProvider placement="top end" />
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/backups" element={<BackupList />} />
            <Route path="/auto-cfg" element={<AutoCfgEditor />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </HashRouter>
      <FirstRunSetup />
      <UpdateChecker />
    </>
  );
}

export default App;

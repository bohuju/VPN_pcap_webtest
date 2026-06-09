import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StatsProvider } from './context/StatsContext';
import Sidebar from './components/Sidebar';
import RefreshBar from './components/RefreshBar';
import OverviewPage from './pages/OverviewPage';
import ProtocolPage from './pages/ProtocolPage';
import PacketSizePage from './pages/PacketSizePage';
import FlowPage from './pages/FlowPage';
import TimeSeriesPage from './pages/TimeSeriesPage';
import TlsPage from './pages/TlsPage';
import DataTablePage from './pages/DataTablePage';
import ModelPage from './pages/ModelPage';
import PredictionPage from './pages/PredictionPage';
import NetworkTopologyPage from './pages/NetworkTopologyPage';

export default function App() {
  return (
    <BrowserRouter>
      <StatsProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <RefreshBar />
            <main className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/protocol" element={<ProtocolPage />} />
                <Route path="/packet-size" element={<PacketSizePage />} />
                <Route path="/flow" element={<FlowPage />} />
                <Route path="/time-series" element={<TimeSeriesPage />} />
                <Route path="/tls" element={<TlsPage />} />
                <Route path="/data-table" element={<DataTablePage />} />
                <Route path="/model" element={<ModelPage />} />
                <Route path="/prediction" element={<PredictionPage />} />
                <Route path="/topology" element={<NetworkTopologyPage />} />
              </Routes>
            </main>
          </div>
        </div>
      </StatsProvider>
    </BrowserRouter>
  );
}

import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { connectLiveSocket } from './api/ws';
import { DashboardPage } from './pages/DashboardPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { DeviceFormPage } from './pages/DeviceFormPage';

export function App() {
  useEffect(() => connectLiveSocket(), []);

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/devices/new" element={<DeviceFormPage />} />
      <Route path="/devices/:id" element={<DeviceDetailPage />} />
      <Route path="/devices/:id/edit" element={<DeviceFormPage />} />
    </Routes>
  );
}

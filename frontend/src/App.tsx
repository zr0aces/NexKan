import { Routes, Route } from 'react-router-dom';
import BoardPage from './pages/BoardPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<BoardPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
    </Routes>
  );
}

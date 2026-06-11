import { HashRouter, Routes, Route } from 'react-router-dom';
import SchedulePage from '@/pages/SchedulePage';
import PetRegisterPage from '@/pages/PetRegisterPage';
import GroomerBoardPage from '@/pages/GroomerBoardPage';
import CustomerViewPage from '@/pages/CustomerViewPage';
import ValidationPanelPage from '@/pages/ValidationPanelPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<SchedulePage />} />
        <Route path="/register" element={<PetRegisterPage />} />
        <Route path="/board" element={<GroomerBoardPage />} />
        <Route path="/customer" element={<CustomerViewPage />} />
        <Route path="/validate" element={<ValidationPanelPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </HashRouter>
  );
}

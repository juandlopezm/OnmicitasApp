import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { AppRouter } from './routes/AppRouter';

function App() {
  return (
    <AdminAuthProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </AdminAuthProvider>
  );
}

export default App;

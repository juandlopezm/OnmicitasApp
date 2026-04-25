import { AuthProvider } from './store/AuthContext';
import { AdminAuthProvider } from './store/AdminAuthContext';
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

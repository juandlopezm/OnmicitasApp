import { Link } from 'react-router-dom'
import { useAdminAuth } from '../hooks/useAdminAuth'
import { AdminNavbar } from '../components/admin/AdminNavbar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, CalendarDays, UserPlus } from 'lucide-react'

export function AdminDashboardPage() {
  const { adminUsuario } = useAdminAuth()

  const accesos = [
    {
      icon: <Users className="size-6 text-primary" />,
      titulo: 'Gestión de Afiliados',
      descripcion: 'Ver, crear y actualizar afiliados (cotizantes y beneficiarios)',
      href: '/admin/afiliados',
      accion: 'Ir a Afiliados',
    },
    {
      icon: <UserPlus className="size-6 text-primary" />,
      titulo: 'Nuevo Afiliado',
      descripcion: 'Registrar un nuevo afiliado en el sistema',
      href: '/admin/afiliados/nuevo',
      accion: 'Crear Afiliado',
    },
    {
      icon: <CalendarDays className="size-6 text-primary" />,
      titulo: 'Gestión de Citas',
      descripcion: 'Ver y actualizar el estado de todas las citas médicas',
      href: '/admin/citas',
      accion: 'Ver Citas',
    },
  ]

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Bienvenido, {adminUsuario?.nombre}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Panel de administración del sistema OmniCitas
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accesos.map(item => (
            <Card key={item.titulo} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="mb-2">{item.icon}</div>
                <CardTitle className="text-base">{item.titulo}</CardTitle>
                <CardDescription className="text-xs">{item.descripcion}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm" className="w-full">
                  <Link to={item.href}>{item.accion}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}

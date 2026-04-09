import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AdminNavbar } from '../components/admin/AdminNavbar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getAfiliados } from '../services/afiliadosService'
import type { Afiliado } from '../types'
import { UserPlus, Users } from 'lucide-react'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'

const ESTADO_VARIANT: Record<Afiliado['estado'], BadgeVariant> = {
  activo:     'success',
  inactivo:   'secondary',
  suspendido: 'warning',
}

const ESTADO_TEXTO: Record<Afiliado['estado'], string> = {
  activo:     'Activo',
  inactivo:   'Inactivo',
  suspendido: 'Suspendido',
}

const TIPO_TEXTO: Record<Afiliado['tipo'], string> = {
  cotizante:    'Cotizante',
  beneficiario: 'Beneficiario',
}

export function AfiliadosListPage() {
  const [afiliados, setAfiliados] = useState<Afiliado[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    getAfiliados().then(data => {
      setAfiliados(data)
      setCargando(false)
    })
  }, [])

  const afiliadosFiltrados = afiliados.filter(a =>
    `${a.nombres} ${a.apellidos} ${a.numeroDocumento} ${a.correo}`
      .toLowerCase()
      .includes(busqueda.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-muted/30">
      <AdminNavbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Afiliados</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {afiliados.length} afiliado{afiliados.length !== 1 ? 's' : ''} registrado{afiliados.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button asChild>
            <Link to="/admin/afiliados/nuevo">
              <UserPlus className="size-4 mr-1.5" />
              Nuevo Afiliado
            </Link>
          </Button>
        </div>

        {/* Búsqueda */}
        <div className="mb-4">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, documento o correo..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {cargando ? (
          <p className="text-muted-foreground text-sm">Cargando afiliados...</p>
        ) : afiliadosFiltrados.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center gap-3">
              <Users className="size-10 text-muted-foreground/40" />
              <div>
                <p className="font-medium">
                  {busqueda ? 'Sin resultados para esta búsqueda' : 'No hay afiliados registrados'}
                </p>
                {!busqueda && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Crea el primer afiliado del sistema
                  </p>
                )}
              </div>
              {!busqueda && (
                <Button asChild>
                  <Link to="/admin/afiliados/nuevo">Crear Afiliado</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-lg border overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Afiliado</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden sm:table-cell">Documento</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Estado</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {afiliadosFiltrados.map(af => (
                  <tr key={af.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{af.nombres} {af.apellidos}</p>
                        <p className="text-xs text-muted-foreground">{af.correo}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-muted-foreground">
                      {af.tipoDocumento} {af.numeroDocumento}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline">{TIPO_TEXTO[af.tipo]}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ESTADO_VARIANT[af.estado]}>
                        {ESTADO_TEXTO[af.estado]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/admin/afiliados/${af.id}/editar`}>Editar</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}

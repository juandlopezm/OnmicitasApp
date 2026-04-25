import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from './hooks/useAdminAuth'
import { FormInput } from '../../components/ui/FormInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { validarEmail, validarCampoRequerido } from '../../utils/validators'
import { Shield } from 'lucide-react'

export function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState<{ email?: string; password?: string }>({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [cargando, setCargando] = useState(false)

  function validar(): boolean {
    const nuevosErrores: { email?: string; password?: string } = {}
    const errEmail = validarCampoRequerido(email)
    if (errEmail) {
      nuevosErrores.email = errEmail
    } else if (!validarEmail(email)) {
      nuevosErrores.email = 'Ingresa un email válido'
    }
    const errPass = validarCampoRequerido(password)
    if (errPass) nuevosErrores.password = errPass
    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorGeneral('')
    if (!validar()) return
    setCargando(true)
    const resultado = await login({ email, password })
    setCargando(false)
    if (resultado.ok) {
      navigate('/admin/dashboard')
    } else {
      setErrorGeneral('Credenciales incorrectas')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground mb-3">
            <Shield className="size-6" />
          </div>
          <h1 className="text-2xl font-bold">OmniCitas</h1>
          <p className="text-sm text-muted-foreground mt-1">Panel de Administración</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Acceso Administrativo</CardTitle>
            <CardDescription>Ingresa tus credenciales de administrador</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-2">
              <FormInput
                label="Correo electrónico"
                type="email"
                name="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={errores.email}
                placeholder="admin@omnicitas.com"
                required
              />
              <FormInput
                label="Contraseña"
                type="password"
                name="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                error={errores.password}
                placeholder="••••••••"
                required
              />

              {errorGeneral && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                  {errorGeneral}
                </p>
              )}

              <Button type="submit" className="w-full mt-2" disabled={cargando}>
                {cargando ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-4 rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Credenciales de administrador</p>
              <code className="text-xs text-primary font-mono">
                admin@omnicitas.com / admin123
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

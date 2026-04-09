import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { FormInput } from '../components/ui/FormInput'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectItem } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { validarCampoRequerido } from '../utils/validators'
import type { TipoDocumento } from '../types'
import { Heart, CheckCircle2 } from 'lucide-react'

const TIPOS_DOCUMENTO: { value: TipoDocumento; label: string }[] = [
  { value: 'CC', label: 'Cédula de Ciudadanía' },
  { value: 'TI', label: 'Tarjeta de Identidad' },
  { value: 'CE', label: 'Cédula de Extranjería' },
  { value: 'PA', label: 'Pasaporte' },
]

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const recienRegistrado = (location.state as { registrado?: boolean } | null)?.registrado ?? false

  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento | ''>('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState<{ tipoDocumento?: string; numeroDocumento?: string; password?: string }>({})
  const [errorGeneral, setErrorGeneral] = useState('')
  const [cargando, setCargando] = useState(false)

  function validar(): boolean {
    const e: typeof errores = {}
    if (!tipoDocumento) e.tipoDocumento = 'Selecciona el tipo de documento'
    const errNum = validarCampoRequerido(numeroDocumento)
    if (errNum) e.numeroDocumento = errNum
    const errPass = validarCampoRequerido(password)
    if (errPass) e.password = errPass
    setErrores(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorGeneral('')
    if (!validar()) return
    setCargando(true)
    const resultado = await login({
      tipo_documento: tipoDocumento as TipoDocumento,
      numero_documento: numeroDocumento,
      password,
    })
    setCargando(false)
    if (resultado.ok) {
      navigate('/dashboard')
    } else {
      setErrorGeneral('Documento o contraseña incorrectos')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center size-12 rounded-xl bg-primary text-primary-foreground mb-3">
            <Heart className="size-6 fill-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">OmniCitas</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sistema Omnicanal de Citas Médicas
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Iniciar sesión</CardTitle>
            <CardDescription>Ingresa tu documento y contraseña</CardDescription>
          </CardHeader>
          <CardContent>
            {recienRegistrado && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 mb-4 text-sm text-green-700">
                <CheckCircle2 className="size-4 shrink-0" />
                Cuenta creada exitosamente. Ya puedes iniciar sesión.
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="tipoDocumento">Tipo de documento</Label>
                <Select
                  id="tipoDocumento"
                  value={tipoDocumento}
                  onChange={e => setTipoDocumento(e.target.value as TipoDocumento)}
                  placeholder="Selecciona..."
                >
                  {TIPOS_DOCUMENTO.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </Select>
                {errores.tipoDocumento && (
                  <p className="text-xs text-destructive">{errores.tipoDocumento}</p>
                )}
              </div>

              <FormInput
                label="Número de documento"
                type="text"
                name="numeroDocumento"
                value={numeroDocumento}
                onChange={e => setNumeroDocumento(e.target.value)}
                error={errores.numeroDocumento}
                placeholder="Ej: 1234567890"
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
                {cargando ? 'Ingresando...' : 'Iniciar sesión'}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-primary font-medium hover:underline">
                Regístrate
              </Link>
            </p>

            {/* Demo credentials */}
            <div className="mt-4 rounded-lg bg-muted p-3 text-center">
              <p className="text-xs text-muted-foreground mb-1">Credenciales de prueba</p>
              <code className="text-xs text-primary font-mono">
                CC · 1234567890 / demo123
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
